import { MntBase, STATUS_CODES, badRequest, forbidden, notFound, conflict, isSupervisor, text, amount } from './mntCommon.js';

// Plan preventivo (063_maintenance_plan.sql, §7 de la política): "cada X
// horas/km o cada N días, lo que ocurra primero". Para cada unidad y cada
// plan que le aplica (por familia del código o tipo de flota) se calcula:
//   - base: último servicio hecho (mnt_unit_plan: cierre de la OT
//     preventiva o registrado a mano). Sin base -> SIN_BASE.
//   - medidor estimado: última lectura (ficha de Flota o la anotada en
//     Combustible) + horas ejecutadas en Control de Horas desde esa fecha
//     (solo horómetro). Sin ninguna lectura -> SIN_LECTURA.
//   - estado: VENCIDO / PROXIMO (dentro de PROXIMO_PORCENTAJE del intervalo
//     o PROXIMO_DIAS) / AL_DIA.

const TZ = 'America/Caracas';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const isoDate = (v) => (v instanceof Date ? v.toLocaleDateString('en-CA', { timeZone: TZ }) : String(v).slice(0, 10));

export const unitFamily = (code) => {
  const m = String(code || '').toUpperCase().replace(/^FP[-.]?/, '').match(/^[A-Z]+/);
  return m ? m[0] : '';
};

export const planApplies = (plan, unit) => {
  if (!plan.active) return false;
  if (plan.fleet_type && unit.fleet_type !== plan.fleet_type) return false;
  if (plan.families) {
    const fams = plan.families.split(',').map((f) => f.trim().toUpperCase()).filter(Boolean);
    if (fams.length && !fams.includes(unitFamily(unit.code))) return false;
  }
  return true;
};

class PlanPreventivo extends MntBase {
  // Medidor estimado por unidad: { KM: {valor, fecha, fuente}, HORAS: {valor, fecha, fuente, horas_desde} }
  meters = async () => {
    const [rows, hours] = await Promise.all([this.query('mntUnitMeters'), this.query('mntRecentHours')]);
    const byUnitHours = new Map();
    for (const h of hours) {
      const k = String(h.unit_id);
      if (!byUnitHours.has(k)) byUnitHours.set(k, []);
      byUnitHours.get(k).push({ fecha: h.fecha, hours: Number(h.hours) || 0 });
    }
    const out = new Map();
    for (const r of rows) {
      const k = String(r.unit_id);
      if (!out.has(k)) out.set(k, {});
      const fecha = isoDate(r.read_at);
      const m = { valor: Number(r.value), fecha, fuente: r.source, horas_desde: 0 };
      if (r.meter === 'HORAS') {
        m.horas_desde = (byUnitHours.get(k) || []).filter((h) => h.fecha > fecha).reduce((s, h) => s + h.hours, 0);
        m.valor = Math.round((m.valor + m.horas_desde) * 10) / 10;
      }
      out.get(k)[r.meter] = m;
    }
    return out;
  };

  // Calcula el semáforo de todas las unidades x planes que les aplican.
  computeDue = async () => {
    const [plans, units, bases, openOrders, meters, cfg] = await Promise.all([
      this.query('mntListPlans'), this.query('mntListUnitsForMnt'), this.query('mntListUnitPlans'),
      this.query('mntOpenPlanOrders'), this.meters(), this.settings(),
    ]);
    const settings = Object.fromEntries((await this.query('mntGetSettings')).map((r) => [r.key, r.value]));
    const pct = Number(settings.PROXIMO_PORCENTAJE ?? 10) / 100;
    const nearDays = Number(settings.PROXIMO_DIAS ?? 7);
    const baseOf = new Map(bases.map((b) => [`${b.unit_id}|${b.plan_id}`, b]));
    const openOf = new Map(openOrders.map((o) => [`${o.unit_id}|${o.plan_id}`, o]));
    const hoy = today();
    const rows = [];
    for (const unit of units) {
      for (const plan of plans) {
        if (!planApplies(plan, unit)) continue;
        const key = `${unit.id}|${plan.id}`;
        const base = baseOf.get(key);
        const open = openOf.get(key);
        const m = plan.meter ? meters.get(String(unit.id))?.[plan.meter] : null;
        const row = {
          unit_id: Number(unit.id), unit_code: unit.code, unit_plate: unit.plate, fleet_type: unit.fleet_type, criticality: unit.criticality,
          operational_status: unit.operational_status,
          plan_id: Number(plan.id), plan_name: plan.name, meter: plan.meter, every_meter: plan.every_meter == null ? null : Number(plan.every_meter), every_days: plan.every_days,
          last_done_at: base?.last_done_at || null, last_done_meter: base?.last_done_meter == null ? null : Number(base.last_done_meter), base_source: base?.source || null,
          current_meter: m ? m.valor : null, meter_date: m?.fecha || null, meter_source: m?.fuente || null, hours_since_reading: m?.horas_desde || 0,
          next_meter: null, remaining_meter: null, next_date: null, remaining_days: null,
          open_order: open ? { id: Number(open.id), number: open.number, status: open.status } : null,
        };
        let state;
        if (!base) state = 'SIN_BASE';
        else {
          const flags = [];
          if (plan.meter) {
            if (row.last_done_meter == null || !m) flags.push('SIN_LECTURA');
            else {
              row.next_meter = row.last_done_meter + row.every_meter;
              row.remaining_meter = Math.round((row.next_meter - m.valor) * 10) / 10;
              flags.push(row.remaining_meter <= 0 ? 'VENCIDO' : row.remaining_meter <= row.every_meter * pct ? 'PROXIMO' : 'AL_DIA');
            }
          }
          if (plan.every_days) {
            row.next_date = addDays(row.last_done_at, plan.every_days);
            row.remaining_days = daysBetween(hoy, row.next_date);
            flags.push(row.remaining_days <= 0 ? 'VENCIDO' : row.remaining_days <= nearDays ? 'PROXIMO' : 'AL_DIA');
          }
          // Lo que ocurra primero: el peor de los dos.
          state = ['VENCIDO', 'PROXIMO', 'SIN_LECTURA', 'AL_DIA'].find((s) => flags.includes(s)) || 'AL_DIA';
          // Si los días ya permiten decidir, SIN_LECTURA del medidor no tapa un vencido por fecha.
          if (state === 'SIN_LECTURA' && flags.includes('VENCIDO')) state = 'VENCIDO';
        }
        row.state = state;
        rows.push(row);
      }
    }
    const order = { VENCIDO: 0, PROXIMO: 1, SIN_LECTURA: 2, SIN_BASE: 3, AL_DIA: 4 };
    rows.sort((a, b) => order[a.state] - order[b.state] || (a.remaining_days ?? 1e9) - (b.remaining_days ?? 1e9) || a.unit_code.localeCompare(b.unit_code));
    return { rows, cfg, auto: settings.MNT_AUTO_PREVENTIVA === 'on' };
  };

  listarVencimientos = async () => {
    const { rows, auto } = await this.computeDue();
    const count = (s) => rows.filter((r) => r.state === s).length;
    const unitsWithoutReading = new Set(rows.filter((r) => r.meter && r.current_meter == null).map((r) => r.unit_id)).size;
    return {
      statusCode: STATUS_CODES.OK,
      data: { vencimientos: rows, resumen: { vencido: count('VENCIDO'), proximo: count('PROXIMO'), al_dia: count('AL_DIA'), sin_base: count('SIN_BASE'), sin_lectura: count('SIN_LECTURA'), unidades_sin_lectura: unitsWithoutReading }, auto_preventiva: auto },
    };
  };

  listarPlanes = async () => ({ statusCode: STATUS_CODES.OK, data: await this.query('mntListPlans') });

  guardarPlan = async ({ id, name, families, fleet_type, meter, every_meter, every_days, tasks, reference, caller_profile }) => {
    if (!isSupervisor(caller_profile)) throw forbidden('Solo el Supervisor de Mantenimiento o la Gerencia editan el plan preventivo.');
    const nombre = text(name, 200);
    if (!nombre) throw badRequest('Escribe el nombre del servicio del plan.');
    const fams = text(families, 100);
    const flota = fleet_type ? String(fleet_type).toUpperCase() : null;
    if (flota && !['LIVIANA', 'PESADA'].includes(flota)) throw badRequest('Tipo de flota inválido.');
    if (!fams && !flota) throw badRequest('Indica a qué equipos aplica: familias (ej. GT, MT) o un tipo de flota.');
    const med = meter ? String(meter).toUpperCase() : null;
    if (med && !['KM', 'HORAS'].includes(med)) throw badRequest('Medidor inválido (KM u HORAS).');
    const cada = amount(every_meter, 'El intervalo del medidor');
    const dias = amount(every_days, 'El intervalo en días');
    if (med && !cada) throw badRequest(`Indica cada cuántas ${med === 'KM' ? 'km' : 'horas'}.`);
    if (!med && !dias) throw badRequest('Indica cada cuántos días (o un intervalo por horas/km).');
    const params = {
      name: nombre, families: fams ? fams.toUpperCase().replace(/\s+/g, '') : null, fleet_type: flota, meter: med,
      every_meter: med ? String(cada) : null, every_days: dias ? Math.round(dias) : null, tasks: text(tasks, 4000) || null, reference: text(reference, 150) || null,
    };
    let planId = id ? Number(id) : null;
    if (planId) {
      const r = await this.query('mntUpdatePlan', { id: planId, ...params });
      if (!r.length) throw notFound('Plan no encontrado.');
    } else {
      planId = Number((await this.query('mntInsertPlan', params))[0].id);
    }
    return { statusCode: id ? STATUS_CODES.OK : STATUS_CODES.CREATED, data: (await this.query('mntGetPlan', { id: planId }))[0], message: 'Plan guardado' };
  };

  archivarPlan = async ({ id, active = false, caller_profile }) => {
    if (!isSupervisor(caller_profile)) throw forbidden('Solo el Supervisor de Mantenimiento o la Gerencia editan el plan preventivo.');
    const r = await this.query('mntSetPlanActive', { id: Number(id), active: !!active });
    if (!r.length) throw notFound('Plan no encontrado.');
    return { statusCode: STATUS_CODES.OK, data: (await this.query('mntGetPlan', { id: Number(id) }))[0], message: active ? 'Plan reactivado' : 'Plan archivado' };
  };

  // Base del plan: cuándo y con qué lectura se hizo el último servicio.
  registrarUltimoServicio = async ({ unit_id, plan_id, done_at, meter_value, caller_profile, caller_user }) => {
    if (!isSupervisor(caller_profile)) throw forbidden('Registra el último servicio el Supervisor de Mantenimiento o la Gerencia.');
    if (!unit_id || !plan_id) throw badRequest('Faltan la unidad o el plan.');
    const [plan] = await this.query('mntGetPlan', { id: Number(plan_id) });
    if (!plan) throw notFound('Plan no encontrado.');
    const fecha = String(done_at || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw badRequest('Indica la fecha del último servicio.');
    if (fecha > today()) throw badRequest('La fecha del último servicio no puede ser futura.');
    const lectura = amount(meter_value, 'La lectura');
    if (plan.meter && lectura == null) throw badRequest(`Indica la lectura del ${plan.meter === 'KM' ? 'odómetro' : 'horómetro'} cuando se hizo el servicio.`);
    await this.query('mntUpsertUnitPlan', { unit_id: Number(unit_id), plan_id: Number(plan_id), last_done_at: fecha, last_done_meter: lectura == null ? null : String(lectura), source: 'MANUAL', work_order_id: null, updated_by: caller_user || null });
    await this.fleetEvent(unit_id, `Plan preventivo: base de "${plan.name}"`, `Último servicio ${fecha}${lectura != null ? ` · ${lectura} ${plan.meter === 'KM' ? 'km' : 'h'}` : ''}`, caller_user);
    return { statusCode: STATUS_CODES.OK, message: 'Último servicio registrado' };
  };

  // OT preventiva desde una fila del semáforo (o desde el cron diario).
  crearOrdenPreventiva = async ({ unit_id, plan_id, caller_profile, caller_user, caller_user_id }) => {
    if (!unit_id || !plan_id) throw badRequest('Faltan la unidad o el plan.');
    const open = (await this.query('mntOpenPlanOrders')).find((o) => Number(o.unit_id) === Number(unit_id) && Number(o.plan_id) === Number(plan_id));
    if (open) throw conflict(`Ya hay una OT abierta para este servicio: ${open.number}.`);
    const [plan] = await this.query('mntGetPlan', { id: Number(plan_id) });
    if (!plan) throw notFound('Plan no encontrado.');
    const { default: OrdenTrabajo } = await import('./ordenTrabajo.js');
    const est = plan.meter ? (await this.meters()).get(String(unit_id))?.[plan.meter] : null;
    const res = await new OrdenTrabajo().crearOrden({
      unit_id, kind: 'PREVENTIVA', title: plan.name, description: plan.reference ? `Plan preventivo · ${plan.reference}` : 'Plan preventivo',
      meter: plan.meter || null, open_meter_value: est ? est.valor : null, plan_id: Number(plan_id),
      tasks: String(plan.tasks || '').split('\n').map((t) => t.trim()).filter(Boolean),
      caller_profile, caller_user, caller_user_id,
    });
    return res;
  };

  // Cron diario (scheduler): crea OT para los vencidos sin OT abierta, si
  // MNT_AUTO_PREVENTIVA = on. Devuelve cuántas creó.
  generarPreventivasVencidas = async () => {
    const { rows, auto } = await this.computeDue();
    if (!auto) return 0;
    let n = 0;
    for (const r of rows.filter((x) => x.state === 'VENCIDO' && !x.open_order)) {
      try { await this.crearOrdenPreventiva({ unit_id: r.unit_id, plan_id: r.plan_id, caller_user: 'Plan preventivo' }); n += 1; }
      catch (e) { console.error(`[Mantenimiento] No se pudo crear la preventiva ${r.unit_code} / ${r.plan_name}:`, e?.message || e); }
    }
    return n;
  };
}

export default PlanPreventivo;
