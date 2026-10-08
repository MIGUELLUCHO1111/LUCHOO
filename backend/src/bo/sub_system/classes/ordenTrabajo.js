import Lectura from './lectura.js';
import {
  MntBase, STATUS_CODES, badRequest, forbidden, notFound, conflict,
  KINDS, PRIORITIES, FAILURE_SYSTEMS, TERMINAL, STATUS_LABEL, ROLE_LABEL,
  isGerencia, isSupervisor, rolesFor, requiredRoles, computeLevel, levelReason,
  text, amount, oneOf,
} from './mntCommon.js';

// Órdenes de Trabajo (Anexo B de la política FP-MTTO-PO-01). Ciclo:
//   SOLICITADA -> (firmas) -> APROBADA -> EN_EJECUCION <-> ESPERA_REPUESTO
//   -> EJECUTADA -> CERRADA (la valida el supervisor)
//   y en cualquier punto abierto: RECHAZADA (solo desde SOLICITADA) o ANULADA.
// Preventiva y emergencia nacen APROBADAS: la preventiva sale del plan
// (§9.1) y la emergencia se ejecuta de una vez y Gerencia la regulariza en
// EMERGENCIA_REGULARIZAR_HORAS (§9.2). Ver mntCommon.js para los niveles.

const hoursBetween = (a, b) => (a && b ? Math.max(0, (new Date(b) - new Date(a)) / 3600000) : null);
const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

// Desglose de la parada (§10.3): diagnóstico/aprobación (abierta -> inicio),
// espera de repuesto (acumulada al pausar/reanudar) y reparación (inicio ->
// ejecutada, sin la espera). Parada total solo si la OT dejó la unidad parada.
export const tiemposOT = (wo) => {
  const wait = (Number(wo.wait_parts_minutes) || 0) / 60 + (wo.paused_at ? hoursBetween(wo.paused_at, new Date()) : 0);
  const reparacion = wo.started_at ? hoursBetween(wo.started_at, wo.executed_at || new Date()) - wait : null;
  return {
    diagnostico_h: round1(hoursBetween(wo.opened_at, wo.started_at || (TERMINAL.includes(wo.status) ? wo.closed_at : new Date()))),
    espera_repuesto_h: round1(wait),
    reparacion_h: reparacion == null ? null : round1(Math.max(0, reparacion)),
    parada_total_h: wo.out_of_service ? round1(hoursBetween(wo.opened_at, wo.closed_at || new Date())) : null,
    cierre_dias: wo.closed_at ? round1(hoursBetween(wo.opened_at, wo.closed_at) / 24) : null,
  };
};

const mustExist = (wo, id) => {
  if (!wo) throw notFound(`Orden de trabajo ${id} no encontrada.`);
  return wo;
};

const assertOpen = (wo, what = 'modificarla') => {
  if (TERMINAL.includes(wo.status)) throw conflict(`La OT ${wo.number} está ${STATUS_LABEL[wo.status].toLowerCase()}: ya no se puede ${what}.`);
};

const assertStatus = (wo, allowed, what) => {
  if (!allowed.includes(wo.status)) {
    throw conflict(`No se puede ${what}: la OT ${wo.number} está "${STATUS_LABEL[wo.status]}".`);
  }
};

class OrdenTrabajo extends MntBase {
  constructor() {
    super();
    this.lectura = new Lectura();
  }

  get = async (id) => (await this.query('mntGetWorkOrder', { id: Number(id) }))[0];

  status = async (wo, status, actor, reason = null) => {
    await this.query('mntSetWorkOrderStatus', { id: Number(wo.id), status, actor: actor || null, reason });
  };

  // Si ya tiene todas las firmas que pide su nivel, pasa a APROBADA.
  approveIfComplete = async (wo, who) => {
    const fresh = await this.get(wo.id);
    if (fresh.status !== 'SOLICITADA') return fresh;
    const ok = new Set((fresh.approvals || []).filter((a) => a.decision === 'APROBADA').map((a) => a.role));
    if (requiredRoles(fresh).every((r) => ok.has(r))) {
      await this.status(fresh, 'APROBADA', who);
      await this.woEvent(fresh.id, 'OT aprobada', null, who);
      return this.get(fresh.id);
    }
    return fresh;
  };

  // ---------- Consultas ----------

  listarOrdenes = async ({ unit_id } = {}) => {
    const [rows, cfg] = await Promise.all([this.query('mntListWorkOrders', { unit_id: unit_id ? Number(unit_id) : null }), this.settings()]);
    // Indicadores de los últimos 90 días: días medios de cierre (abierta ->
    // cerrada) y horas medias de reparación de correctivas/emergencias (base del MTTR).
    const desde = Date.now() - 90 * 86400000;
    const cerradas = rows.filter((w) => w.status === 'CERRADA' && w.closed_at && new Date(w.closed_at).getTime() >= desde).map((w) => ({ w, t: tiemposOT(w) }));
    const avg = (xs) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    const kpis = {
      cerradas_90d: cerradas.length,
      dias_medios_cierre: avg(cerradas.map((x) => x.t.cierre_dias).filter((v) => v != null)),
      horas_medias_reparacion: avg(cerradas.filter((x) => x.w.kind !== 'PREVENTIVA').map((x) => x.t.reparacion_h).filter((v) => v != null)),
    };
    return { statusCode: STATUS_CODES.OK, data: { ordenes: rows.map((w) => ({ ...w, tiempos: tiemposOT(w) })), ajustes: cfg, kpis } };
  };

  obtenerOrden = async ({ id }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    const wo = mustExist(await this.get(id), id);
    const [tareas, repuestos, archivos, eventos, incidencias, cfg] = await Promise.all([
      this.query('mntListTasks', { work_order_id: Number(id) }),
      this.query('mntListParts', { work_order_id: Number(id) }),
      this.query('mntListFiles', { work_order_id: Number(id) }),
      this.query('mntListEvents', { work_order_id: Number(id) }),
      this.query('mntListIncidents', { unit_id: null, work_order_id: Number(id) }),
      this.settings(),
    ]);
    return { statusCode: STATUS_CODES.OK, data: { ...wo, required_roles: requiredRoles(wo), tiempos: tiemposOT(wo), tareas, repuestos, archivos, eventos, incidencias, ajustes: cfg } };
  };

  // ---------- Crear ----------

  crearOrden = async ({ unit_id, kind, title, description, priority, estimated_cost_usd, special_purchase, out_of_service, meter, open_meter_value, technician, provider, provider_id, plan_id, incident_ids, tasks, caller_user, caller_user_id }) => {
    if (!unit_id) throw badRequest('Elige la unidad.');
    const tipo = oneOf(kind, KINDS, 'Tipo de OT');
    if (!tipo) throw badRequest('Elige el tipo de OT (preventiva, correctiva o emergencia).');
    const titulo = text(title, 200);
    if (!titulo) throw badRequest('Escribe un título corto de la OT (qué hay que hacer o qué falló).');
    const [unit] = await this.query('mntGetUnit', { id: Number(unit_id) });
    if (!unit || unit.deleted_at) throw notFound('La unidad no existe o fue dada de baja.');

    const cfg = await this.settings();
    const criticality = await this.unitCriticality(unit_id);
    const cost = amount(estimated_cost_usd, 'El costo estimado');
    const special = !!special_purchase;
    const level = tipo === 'CORRECTIVA' ? computeLevel({ criticality, estimatedCost: cost, specialPurchase: special, threshold: cfg.threshold }) : null;
    const estado = tipo === 'CORRECTIVA' ? 'SOLICITADA' : 'APROBADA';
    const parada = tipo === 'EMERGENCIA' ? out_of_service !== false : !!out_of_service;
    const medidor = oneOf(meter, ['KM', 'HORAS'], 'Medidor');
    const lectura = amount(open_meter_value, 'La lectura del medidor');
    const due = tipo === 'EMERGENCIA' ? new Date(Date.now() + cfg.regularizeHours * 3600 * 1000).toISOString() : null;

    const year = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' }).slice(0, 4));
    const [{ last_seq }] = await this.query('mntNextNumber', { year });
    const number = `OT-${String(year).slice(2)}-${String(last_seq).padStart(4, '0')}`;
    const who = caller_user || null;

    const [{ id }] = await this.query('mntInsertWorkOrder', {
      number, unit_id: Number(unit_id), kind: tipo, level, status: estado,
      priority: oneOf(priority, PRIORITIES, 'Prioridad') || (tipo === 'EMERGENCIA' ? 'CRITICA' : 'MEDIA'),
      title: titulo, description: text(description, 4000) || null, criticality,
      estimated_cost_usd: cost == null ? null : String(cost), special_purchase: special, out_of_service: parada,
      meter: medidor || null, open_meter_value: lectura == null ? null : String(lectura),
      technician: text(technician, 150) || null, provider: text(provider, 150) || null,
      regularize_due_at: due, opened_by: who, opened_by_user_id: caller_user_id ? Number(caller_user_id) : null,
    });
    if (plan_id) await this.query('mntSetWorkOrderPlan', { id: Number(id), plan_id: Number(plan_id) });
    if (provider_id) await this.query('mntSetWorkOrderProvider', { id: Number(id), provider_id: Number(provider_id) });
    const wo = await this.get(id);

    const detalle = tipo === 'CORRECTIVA'
      ? `Correctiva ${level.toLowerCase()}${levelReason({ criticality, estimatedCost: cost, specialPurchase: special, threshold: cfg.threshold }) ? ` (${levelReason({ criticality, estimatedCost: cost, specialPurchase: special, threshold: cfg.threshold })})` : ''}. Necesita la firma de: ${requiredRoles(wo).map((r) => ROLE_LABEL[r]).join(' y ')}.`
      : tipo === 'EMERGENCIA' ? `Emergencia: se ejecuta de inmediato; Gerencia de Mantenimiento debe regularizarla antes del ${new Date(due).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}.`
        : 'Preventiva: aprobada por el plan; el supervisor la valida al cerrar.';
    await this.woEvent(id, `OT abierta (${STATUS_LABEL[estado]})`, detalle, who);
    await this.fleetEvent(unit_id, `${number} abierta: ${titulo}`, detalle, who);

    for (const t of Array.isArray(tasks) ? tasks : []) {
      const d = text(t, 300);
      if (d) await this.query('mntInsertTask', { work_order_id: Number(id), description: d });
    }
    const ids = (Array.isArray(incident_ids) ? incident_ids : []).map(Number).filter(Number.isInteger);
    if (ids.length) {
      const linked = await this.query('mntLinkIncidents', { ids: ids.join(','), work_order_id: Number(id), unit_id: Number(unit_id) });
      if (linked.length) await this.woEvent(id, `${linked.length} incidencia(s) incluida(s) en la OT`, null, who);
    }
    if (parada) await this.markOutOfService(wo, who);

    return { statusCode: STATUS_CODES.CREATED, data: await this.get(id), message: `${number} creada` };
  };

  // ---------- Editar datos ----------

  actualizarOrden = async ({ id, title, description, priority, estimated_cost_usd, special_purchase, technician, provider, provider_id, labor_hours, failure_system, functional_test, result, out_of_service, caller_user }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    const wo = mustExist(await this.get(id), id);
    assertOpen(wo);
    const patch = {};
    const set = (k, v) => { if (v !== undefined) patch[k] = v; };
    if (title !== undefined) { const t = text(title, 200); if (!t) throw badRequest('El título no puede quedar vacío.'); patch.title = t; }
    set('description', text(description, 4000));
    set('priority', oneOf(priority, PRIORITIES, 'Prioridad'));
    set('technician', text(technician, 150));
    set('provider', text(provider, 150));
    set('result', text(result, 4000));
    set('failure_system', oneOf(failure_system, FAILURE_SYSTEMS, 'Sistema de la falla'));
    const horas = amount(labor_hours, 'Las horas de intervención');
    if (horas !== undefined) patch.labor_hours = horas;
    if (functional_test !== undefined) patch.functional_test = functional_test === null ? null : !!functional_test;

    // Costo / compra especial: recalculan el nivel mientras la OT espera firmas.
    const cost = amount(estimated_cost_usd, 'El costo estimado');
    if (cost !== undefined) patch.estimated_cost_usd = cost;
    if (special_purchase !== undefined) patch.special_purchase = !!special_purchase;
    let nivelCambio = null;
    if (wo.kind === 'CORRECTIVA' && wo.status === 'SOLICITADA' && (cost !== undefined || special_purchase !== undefined)) {
      const cfg = await this.settings();
      const nuevo = computeLevel({
        criticality: wo.criticality_at_open,
        estimatedCost: cost !== undefined ? cost : wo.estimated_cost_usd,
        specialPurchase: special_purchase !== undefined ? !!special_purchase : wo.special_purchase,
        threshold: cfg.threshold,
      });
      if (nuevo !== wo.level) { patch.level = nuevo; nivelCambio = nuevo; }
    }

    // JSON con números/booleanos como texto: el SQL los convierte (::numeric / ::boolean).
    const asText = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === null ? null : typeof v === 'string' ? v : String(v)]));
    if (Object.keys(asText).length) await this.query('mntUpdateWorkOrder', { id: Number(id), patch: JSON.stringify(asText) });

    const who = caller_user || null;
    if (provider_id !== undefined) await this.query('mntSetWorkOrderProvider', { id: Number(id), provider_id: provider_id ? Number(provider_id) : null });
    if (out_of_service !== undefined && !!out_of_service !== wo.out_of_service) {
      await this.query('mntUpdateWorkOrderFlag', { id: Number(id), out_of_service: !!out_of_service });
      const fresh = await this.get(id);
      if (out_of_service) { await this.markOutOfService(fresh, who); await this.woEvent(id, 'La unidad quedó fuera de servicio por esta OT', null, who); }
      else { await this.releaseUnit({ ...fresh, out_of_service: true }, who); await this.woEvent(id, 'La unidad ya no está parada por esta OT', null, who); }
    }
    if (nivelCambio) await this.woEvent(id, `Nivel recalculado: correctiva ${nivelCambio.toLowerCase()}`, `Ahora necesita la firma de: ${requiredRoles({ ...wo, level: nivelCambio }).map((r) => ROLE_LABEL[r]).join(' y ')}.`, who);
    else if (Object.keys(asText).length) await this.woEvent(id, 'Datos de la OT actualizados', Object.keys(asText).join(', '), who);

    return { statusCode: STATUS_CODES.OK, data: await this.approveIfComplete(await this.get(id), who), message: 'OT actualizada' };
  };

  // ---------- Firmas (§9.4) ----------

  aprobarOrden = async ({ id, role, note, caller_profile, caller_user, caller_user_id }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    const wo = mustExist(await this.get(id), id);
    assertStatus(wo, ['SOLICITADA'], 'aprobarla');
    const puede = rolesFor(caller_profile);
    if (!puede.length) throw forbidden('Tu perfil no firma órdenes de trabajo (firman el Supervisor de Mantenimiento y la Gerencia).');
    const faltan = requiredRoles(wo).filter((r) => !(wo.approvals || []).some((a) => a.role === r && a.decision === 'APROBADA'));
    const rol = role ? String(role).toUpperCase() : faltan.find((r) => puede.includes(r));
    if (!rol || !faltan.includes(rol)) throw conflict(faltan.length ? `Esta OT necesita la firma de: ${faltan.map((r) => ROLE_LABEL[r]).join(' y ')}.` : 'Esta OT ya tiene todas las firmas.');
    if (!puede.includes(rol)) throw forbidden(`Tu perfil no puede firmar como ${ROLE_LABEL[rol]}.`);
    // Correctiva mayor: las dos gerencias deben ser personas distintas.
    if (wo.level === 'MAYOR' && (wo.approvals || []).some((a) => a.decision === 'APROBADA' && Number(a.user_id) === Number(caller_user_id))) {
      throw conflict('La correctiva mayor necesita dos firmas de personas distintas (Gerencia de Mantenimiento y Gerencia de Operaciones). Ya firmaste esta OT.');
    }
    const ins = await this.query('mntInsertApproval', { work_order_id: Number(id), role: rol, decision: 'APROBADA', note: text(note, 1000) || null, user_id: caller_user_id ? Number(caller_user_id) : null, user_name: caller_user || null });
    if (!ins.length) throw conflict(`Ya hay una firma de ${ROLE_LABEL[rol]} en esta OT.`);
    await this.woEvent(id, `Firmada por ${ROLE_LABEL[rol]}`, note || null, caller_user);
    const fresh = await this.approveIfComplete(wo, caller_user);
    return { statusCode: STATUS_CODES.OK, data: fresh, message: fresh.status === 'APROBADA' ? 'OT aprobada' : `Firma registrada; falta ${requiredRoles(fresh).filter((r) => r !== rol && !(fresh.approvals || []).some((a) => a.role === r)).map((r) => ROLE_LABEL[r]).join(' y ')}` };
  };

  rechazarOrden = async ({ id, reason, caller_profile, caller_user, caller_user_id }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    const wo = mustExist(await this.get(id), id);
    assertStatus(wo, ['SOLICITADA'], 'rechazarla');
    const motivo = text(reason, 1000);
    if (!motivo) throw badRequest('Escribe el motivo del rechazo.');
    const rol = requiredRoles(wo).find((r) => rolesFor(caller_profile).includes(r));
    if (!rol) throw forbidden('Tu perfil no puede decidir sobre esta OT.');
    await this.query('mntInsertApproval', { work_order_id: Number(id), role: rol, decision: 'RECHAZADA', note: motivo, user_id: caller_user_id ? Number(caller_user_id) : null, user_name: caller_user || null });
    await this.status(wo, 'RECHAZADA', caller_user, motivo);
    await this.woEvent(id, `Rechazada por ${ROLE_LABEL[rol]}`, motivo, caller_user);
    await this.query('mntSetIncidentsByWorkOrder', { work_order_id: Number(id), status: 'ABIERTA' });
    await this.releaseUnit(wo, caller_user);
    await this.fleetEvent(wo.unit_id, `${wo.number} rechazada`, motivo, caller_user);
    return { statusCode: STATUS_CODES.OK, data: await this.get(id), message: 'OT rechazada' };
  };

  regularizarOrden = async ({ id, note, caller_profile, caller_user, caller_user_id }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    if (!isGerencia(caller_profile)) throw forbidden('Solo Gerencia de Mantenimiento regulariza una emergencia.');
    const wo = mustExist(await this.get(id), id);
    if (wo.kind !== 'EMERGENCIA') throw conflict('Solo las OT de emergencia se regularizan.');
    if (wo.regularized_at) throw conflict('Esta emergencia ya fue regularizada.');
    if (['RECHAZADA', 'ANULADA'].includes(wo.status)) throw conflict('La OT está anulada.');
    await this.query('mntInsertApproval', { work_order_id: Number(id), role: 'GERENCIA_MTTO', decision: 'APROBADA', note: text(note, 1000) || null, user_id: caller_user_id ? Number(caller_user_id) : null, user_name: caller_user || null });
    await this.query('mntSetRegularized', { id: Number(id) });
    const tarde = wo.regularize_due_at && new Date() > new Date(wo.regularize_due_at);
    await this.woEvent(id, `Emergencia regularizada por Gerencia de Mantenimiento${tarde ? ' (fuera de plazo)' : ''}`, note || null, caller_user);
    return { statusCode: STATUS_CODES.OK, data: await this.get(id), message: 'Emergencia regularizada' };
  };

  // ---------- Ejecución ----------

  iniciarOrden = async ({ id, technician, caller_user }) => {
    const wo = mustExist(await this.get(id), id);
    assertStatus(wo, ['APROBADA'], 'iniciarla');
    const tec = text(technician, 150);
    if (tec) await this.query('mntUpdateWorkOrder', { id: Number(id), patch: JSON.stringify({ technician: tec }) });
    await this.status(wo, 'EN_EJECUCION', caller_user);
    await this.woEvent(id, 'Trabajo iniciado', tec ? `Técnico: ${tec}` : null, caller_user);
    return { statusCode: STATUS_CODES.OK, data: await this.get(id), message: 'OT en ejecución' };
  };

  pausarOrden = async ({ id, note, caller_user }) => {
    const wo = mustExist(await this.get(id), id);
    assertStatus(wo, ['EN_EJECUCION'], 'pasarla a espera de repuesto');
    await this.status(wo, 'ESPERA_REPUESTO', caller_user);
    await this.query('mntPauseWorkOrder', { id: Number(id) });
    await this.woEvent(id, 'En espera de repuesto', text(note, 1000) || null, caller_user);
    return { statusCode: STATUS_CODES.OK, data: await this.get(id), message: 'OT en espera de repuesto' };
  };

  reanudarOrden = async ({ id, note, caller_user }) => {
    const wo = mustExist(await this.get(id), id);
    assertStatus(wo, ['ESPERA_REPUESTO'], 'reanudarla');
    await this.query('mntResumeWorkOrder', { id: Number(id) });
    await this.status(wo, 'EN_EJECUCION', caller_user);
    await this.woEvent(id, 'Trabajo reanudado', text(note, 1000) || null, caller_user);
    return { statusCode: STATUS_CODES.OK, data: await this.get(id), message: 'OT en ejecución' };
  };

  // El técnico termina: pide quién lo hizo, horas de intervención y resultado.
  ejecutarOrden = async ({ id, technician, labor_hours, result, functional_test, failure_system, caller_user }) => {
    const wo = mustExist(await this.get(id), id);
    assertStatus(wo, ['EN_EJECUCION'], 'marcarla como ejecutada');
    const tec = text(technician, 150) ?? wo.technician;
    const horas = amount(labor_hours, 'Las horas de intervención') ?? (wo.labor_hours == null ? null : Number(wo.labor_hours));
    const res = text(result, 4000) ?? wo.result;
    if (!tec) throw badRequest('Indica el técnico que ejecutó el trabajo.');
    if (horas == null) throw badRequest('Indica las horas de intervención.');
    if (!res) throw badRequest('Describe el trabajo realizado y el resultado.');
    const patch = { technician: tec, labor_hours: String(horas), result: res };
    if (functional_test !== undefined) patch.functional_test = String(!!functional_test);
    const sys = oneOf(failure_system, FAILURE_SYSTEMS, 'Sistema de la falla');
    if (sys) patch.failure_system = sys;
    await this.query('mntUpdateWorkOrder', { id: Number(id), patch: JSON.stringify(patch) });
    await this.status(wo, 'EJECUTADA', caller_user);
    const pendientes = (wo.tasks_total || 0) - (wo.tasks_done || 0);
    await this.woEvent(id, 'Trabajo ejecutado', `${tec} · ${horas} h${pendientes > 0 ? ` · ${pendientes} tarea(s) sin marcar` : ''}`, caller_user);
    return { statusCode: STATUS_CODES.OK, data: await this.get(id), message: 'OT ejecutada: falta que el supervisor la cierre' };
  };

  // Cierre y validación (supervisor, §9.5): lectura del medidor al cerrar,
  // sistema de la falla en correctivas/emergencias, emergencia regularizada.
  cerrarOrden = async ({ id, close_meter_value, failure_system, note, caller_profile, caller_user }) => {
    if (!isSupervisor(caller_profile)) throw forbidden('El cierre lo valida el Supervisor de Mantenimiento o la Gerencia.');
    const wo = mustExist(await this.get(id), id);
    assertStatus(wo, ['EJECUTADA'], 'cerrarla');
    if (wo.kind === 'EMERGENCIA' && !wo.regularized_at) throw conflict('Esta emergencia todavía no fue regularizada por Gerencia de Mantenimiento.');
    const sys = oneOf(failure_system, FAILURE_SYSTEMS, 'Sistema de la falla') || wo.failure_system;
    if (wo.kind !== 'PREVENTIVA' && !sys) throw badRequest('Indica el sistema donde estuvo la falla (mecánico, hidráulico, eléctrico, estructural, operador u otro).');
    if (sys && sys !== wo.failure_system) await this.query('mntUpdateWorkOrder', { id: Number(id), patch: JSON.stringify({ failure_system: sys }) });

    // Lectura del medidor al cerrar -> historial de lecturas de la ficha (source MANTENIMIENTO).
    const lectura = amount(close_meter_value, 'La lectura del medidor');
    if (lectura != null) {
      const meter = wo.meter || (wo.unit_fleet_type === 'PESADA' ? 'HORAS' : 'KM');
      const { ultima } = await this.lectura.ultimaDeSerie(wo.unit_id, meter);
      if (ultima && lectura < Number(ultima.value)) throw badRequest(`La lectura de cierre (${lectura}) es menor que la última registrada de la unidad (${Number(ultima.value)}). Revisa el ${meter === 'KM' ? 'odómetro' : 'horómetro'}.`);
      await this.query('fleetInsertReading', { unit_id: Number(wo.unit_id), meter, value: String(lectura), read_at: new Date().toISOString(), source: 'MANTENIMIENTO', note: `Cierre de ${wo.number}`, created_by: caller_user || null });
      await this.query('mntSetCloseMeter', { id: Number(id), value: String(lectura) });
    }

    await this.status(wo, 'CERRADA', caller_user);
    await this.woEvent(id, 'OT cerrada y validada', text(note, 1000) || null, caller_user);
    if (wo.plan_id) {
      const base = lectura ?? (wo.open_meter_value == null ? null : Number(wo.open_meter_value));
      await this.query('mntUpsertUnitPlan', {
        unit_id: Number(wo.unit_id), plan_id: Number(wo.plan_id), last_done_at: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' }),
        last_done_meter: base == null ? null : String(base), source: 'OT', work_order_id: Number(id), updated_by: caller_user || null,
      });
      await this.woEvent(id, 'Plan preventivo actualizado', base == null ? 'Sin lectura: el próximo vencimiento se calcula solo por fecha.' : `Próximo servicio desde ${base}`, caller_user);
    }
    await this.query('mntSetIncidentsByWorkOrder', { work_order_id: Number(id), status: 'RESUELTA' });
    await this.releaseUnit(wo, caller_user);
    await this.fleetEvent(wo.unit_id, `${wo.number} cerrada: ${wo.title}`, [wo.technician && `Técnico: ${wo.technician}`, wo.labor_hours != null && `${Number(wo.labor_hours)} h`, lectura != null && `Lectura: ${lectura}`].filter(Boolean).join(' · ') || null, caller_user);
    return { statusCode: STATUS_CODES.OK, data: await this.get(id), message: `${wo.number} cerrada` };
  };

  anularOrden = async ({ id, reason, caller_profile, caller_user }) => {
    if (!isGerencia(caller_profile)) throw forbidden('Solo la Gerencia o un administrador anula una OT.');
    const wo = mustExist(await this.get(id), id);
    assertOpen(wo, 'anularla');
    const motivo = text(reason, 1000);
    if (!motivo) throw badRequest('Escribe el motivo de la anulación.');
    await this.status(wo, 'ANULADA', caller_user, motivo);
    await this.woEvent(id, 'OT anulada', motivo, caller_user);
    await this.query('mntSetIncidentsByWorkOrder', { work_order_id: Number(id), status: 'ABIERTA' });
    await this.releaseUnit(wo, caller_user);
    await this.fleetEvent(wo.unit_id, `${wo.number} anulada`, motivo, caller_user);
    return { statusCode: STATUS_CODES.OK, data: await this.get(id), message: 'OT anulada' };
  };

  // ---------- Tareas y repuestos ----------

  agregarTareaOrden = async ({ id, description, caller_user }) => {
    const wo = mustExist(await this.get(id), id);
    assertOpen(wo);
    const d = text(description, 300);
    if (!d) throw badRequest('Describe la tarea.');
    await this.query('mntInsertTask', { work_order_id: Number(id), description: d });
    await this.woEvent(id, 'Tarea agregada', d, caller_user);
    return { statusCode: STATUS_CODES.CREATED, data: await this.query('mntListTasks', { work_order_id: Number(id) }) };
  };

  marcarTareaOrden = async ({ id, task_id, done, caller_user }) => {
    const wo = mustExist(await this.get(id), id);
    assertOpen(wo);
    const r = await this.query('mntSetTaskDone', { id: Number(task_id), work_order_id: Number(id), done: !!done, done_by: caller_user || null });
    if (!r.length) throw notFound('Tarea no encontrada en esta OT.');
    return { statusCode: STATUS_CODES.OK, data: await this.query('mntListTasks', { work_order_id: Number(id) }) };
  };

  eliminarTareaOrden = async ({ id, task_id, caller_user }) => {
    const wo = mustExist(await this.get(id), id);
    assertOpen(wo);
    const r = await this.query('mntDeleteTask', { id: Number(task_id), work_order_id: Number(id) });
    if (!r.length) throw notFound('Tarea no encontrada en esta OT.');
    await this.woEvent(id, 'Tarea eliminada', null, caller_user);
    return { statusCode: STATUS_CODES.OK, data: await this.query('mntListTasks', { work_order_id: Number(id) }) };
  };

  agregarRepuestoOrden = async ({ id, part_number, description, quantity, unit_cost_usd, provider, reason, caller_user }) => {
    const wo = mustExist(await this.get(id), id);
    assertOpen(wo);
    const d = text(description, 200);
    if (!d) throw badRequest('Describe el repuesto o material.');
    const qty = amount(quantity ?? 1, 'La cantidad');
    if (!qty) throw badRequest('La cantidad debe ser mayor a 0.');
    const cost = amount(unit_cost_usd, 'El costo unitario');
    await this.query('mntInsertPart', { work_order_id: Number(id), part_number: text(part_number, 80) || null, description: d, quantity: String(qty), unit_cost_usd: cost == null ? null : String(cost), provider: text(provider, 150) || null, reason: text(reason, 200) || null, created_by: caller_user || null });
    await this.woEvent(id, 'Repuesto registrado', `${qty} × ${d}${cost != null ? ` · ${cost} USD c/u` : ''}`, caller_user);
    return { statusCode: STATUS_CODES.CREATED, data: await this.query('mntListParts', { work_order_id: Number(id) }) };
  };

  eliminarRepuestoOrden = async ({ id, part_id, caller_user }) => {
    const wo = mustExist(await this.get(id), id);
    assertOpen(wo);
    const r = await this.query('mntDeletePart', { id: Number(part_id), work_order_id: Number(id) });
    if (!r.length) throw notFound('Repuesto no encontrado en esta OT.');
    await this.woEvent(id, 'Repuesto eliminado', null, caller_user);
    return { statusCode: STATUS_CODES.OK, data: await this.query('mntListParts', { work_order_id: Number(id) }) };
  };
}

export default OrdenTrabajo;
