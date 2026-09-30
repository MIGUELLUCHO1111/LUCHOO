import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import { assertUnitAccess, assertAdmin } from './fleetAccess.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Historial de lecturas de odometro/horometro (050_fleet_unit_reading.sql),
// respuestas de Julio 30/09/2026: "el odometro no se edita, se vuelve a
// leer". Reglas:
//   * La primera lectura de cada medidor es la BASE.
//   * Una lectura nueva no puede ser menor que la ultima de la serie; si se
//     cambio el tablero se registra un REEMPLAZO, que empieza serie nueva.
//   * Un error no se edita: un admin ANULA la lectura con motivo.
//   * Combustible y Control de Horas no se copian: se leen al consultar.
// Nombres de metodo unicos a proposito (los permisos van por nombre).

const METERS = ['KM', 'HORAS'];
const UNIT_LABEL = { KM: 'km', HORAS: 'h' };
const badRequest = (message) => new Error(JSON.stringify({ message, statusCode: STATUS_CODES.BAD_REQUEST }));
const notFound = (message) => new Error(JSON.stringify({ message, statusCode: STATUS_CODES.NOT_FOUND }));
const fmt = (n, meter) => `${Number(n).toLocaleString('es-VE', { maximumFractionDigits: 1 })} ${UNIT_LABEL[meter]}`;
const toIso = (v) => {
  if (!v) return new Date().toISOString();
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00-04:00` : v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Medidores que usa la unidad segun su modelo del catalogo (por defecto km). */
export const medidoresDe = (unidad) => {
  const m = unidad?.model_meter;
  if (m === 'AMBOS') return ['KM', 'HORAS'];
  if (m === 'HORAS') return ['HORAS'];
  return ['KM'];
};

/**
 * Resumen de lecturas de una unidad: historial propio + lecturas de
 * Combustible, valor actual por medidor y, para horas, la estimacion con
 * Control de Horas desde la ultima lectura.
 */
export async function resumenLecturas(dbms, unidad) {
  const q = async (nameQuery, params) => (await dbms.executeNamedQuery({ nameQuery, params }))?.rows || [];
  const [propias, combustible] = await Promise.all([
    q('fleetListReadings', { unit_id: Number(unidad.id) }),
    q('fleetFuelReadings', { unit_id: Number(unidad.id) }),
  ]);
  const historial = [
    ...propias.map((r) => ({ ...r, value: Number(r.value) })),
    ...combustible.map((r, i) => ({ id: `comb-${i}`, meter: r.meter, value: Number(r.value), read_at: r.read_at, source: 'COMBUSTIBLE', derived: true })),
  ].sort((a, b) => new Date(b.read_at) - new Date(a.read_at));

  const medidores = medidoresDe(unidad);
  const actual = {};
  for (const meter of [...new Set([...medidores, ...historial.filter((h) => !h.voided_at).map((h) => h.meter)])]) {
    const vivas = historial.filter((h) => h.meter === meter && !h.voided_at);
    const base = vivas.find((h) => h.source === 'BASE' || h.source === 'REEMPLAZO');
    const serie = base ? vivas.filter((h) => new Date(h.read_at) >= new Date(base.read_at)) : vivas;
    const ultima = serie[0] || null;
    if (!ultima) continue;
    actual[meter] = { valor: ultima.value, fecha: ultima.read_at, fuente: ultima.source, base: base ? { valor: base.value, fecha: base.read_at, reemplazo: base.source === 'REEMPLAZO' } : null };
    // Horometro: sumar las horas trabajadas de Control de Horas desde la ultima lectura.
    if (meter === 'HORAS') {
      const [h] = await q('fleetHoursSince', { unit_id: Number(unidad.id), since: String(ultima.read_at).slice(0, 10) });
      if (h && Number(h.total) > 0) {
        actual.HORAS.estimado = { valor: ultima.value + Number(h.total), hasta: h.ultima, dias: h.dias, horas: Number(h.total) };
      }
    }
  }
  return { medidores, actual, historial };
}

class Lectura {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  query = async (nameQuery, params = {}) => {
    await this.dbmsReady;
    const result = await this.dbms.executeNamedQuery({ nameQuery, params });
    return result?.rows || [];
  };

  evento = (unit_id, title, detail, created_by) =>
    this.query('fleetInsertEvent', { unit_id: Number(unit_id), event_type: 'ODOMETRO', title, detail: detail || null, created_by: created_by || null });

  // Ultima lectura vigente de la serie actual (desde la ultima BASE/REEMPLAZO).
  ultimaDeSerie = async (unit_id, meter) => {
    const vivas = (await this.query('fleetListReadings', { unit_id: Number(unit_id) })).filter((r) => r.meter === meter && !r.voided_at);
    const base = vivas.find((r) => r.source === 'BASE' || r.source === 'REEMPLAZO');
    const serie = base ? vivas.filter((r) => new Date(r.read_at) >= new Date(base.read_at)) : vivas;
    return { ultima: serie[0] || null, base: base || null, hayLecturas: vivas.length > 0 };
  };

  registrarLectura = async ({ unit_id, meter = 'KM', value, read_at, note, caller_profile, caller_user_id, caller_user }) => {
    if (!unit_id) throw badRequest("Campo requerido: 'unit_id'");
    if (!METERS.includes(meter)) throw badRequest('Medidor inválido (KM u HORAS)');
    const valor = Number(String(value ?? '').replace(',', '.'));
    if (!Number.isFinite(valor) || valor < 0) throw badRequest('Indica una lectura válida (número mayor o igual a 0).');
    const fecha = toIso(read_at);
    if (!fecha) throw badRequest('Fecha de la lectura inválida.');
    if (new Date(fecha) > new Date(Date.now() + 36 * 3600 * 1000)) throw badRequest('La fecha de la lectura no puede ser futura.');
    await this.dbmsReady;
    await assertUnitAccess(this.dbms, { caller_profile, caller_user_id, unit_id });

    const { ultima, base, hayLecturas } = await this.ultimaDeSerie(unit_id, meter);
    if (base && new Date(fecha) < new Date(base.read_at)) throw badRequest(`La fecha es anterior a la lectura base (${new Date(base.read_at).toLocaleDateString('es-VE')}).`);
    if (ultima && valor < Number(ultima.value)) {
      throw badRequest(`La lectura (${fmt(valor, meter)}) es menor que la anterior (${fmt(ultima.value, meter)}). El odómetro no se corrige: si se cambió el tablero, registra "Tablero reemplazado".`);
    }
    const source = hayLecturas ? 'MANUAL' : 'BASE';
    const [row] = await this.query('fleetInsertReading', { unit_id: Number(unit_id), meter, value: String(valor), read_at: fecha, source, note: note ? String(note).trim().slice(0, 250) : null, created_by: caller_user || null });
    await this.evento(unit_id, `${source === 'BASE' ? 'Lectura base' : 'Lectura'} de ${meter === 'KM' ? 'odómetro' : 'horómetro'}: ${fmt(valor, meter)}`, note, caller_user);
    return { statusCode: STATUS_CODES.CREATED, data: { id: row.id, source }, message: source === 'BASE' ? 'Lectura base registrada' : 'Lectura registrada' };
  };

  // Cambio de tablero: la lectura del tablero nuevo empieza una serie nueva.
  reemplazarMedidor = async ({ unit_id, meter = 'KM', value, read_at, note, caller_profile, caller_user_id, caller_user }) => {
    if (!unit_id) throw badRequest("Campo requerido: 'unit_id'");
    if (!METERS.includes(meter)) throw badRequest('Medidor inválido (KM u HORAS)');
    const valor = Number(String(value ?? '').replace(',', '.'));
    if (!Number.isFinite(valor) || valor < 0) throw badRequest('Indica la lectura del tablero nuevo.');
    const fecha = toIso(read_at);
    if (!fecha) throw badRequest('Fecha del reemplazo inválida.');
    if (!note || !String(note).trim()) throw badRequest('Explica el reemplazo (ej. "Se cambió el tablero en el taller X").');
    await this.dbmsReady;
    await assertUnitAccess(this.dbms, { caller_profile, caller_user_id, unit_id });
    const { ultima } = await this.ultimaDeSerie(unit_id, meter);
    const [row] = await this.query('fleetInsertReading', { unit_id: Number(unit_id), meter, value: String(valor), read_at: fecha, source: 'REEMPLAZO', note: String(note).trim().slice(0, 250), created_by: caller_user || null });
    await this.evento(unit_id, `${meter === 'KM' ? 'Odómetro' : 'Horómetro'} reemplazado el ${new Date(fecha).toLocaleDateString('es-VE')}: nuevo tablero en ${fmt(valor, meter)}`, ultima ? `El anterior marcaba ${fmt(ultima.value, meter)}. ${String(note).trim()}` : String(note).trim(), caller_user);
    return { statusCode: STATUS_CODES.CREATED, data: { id: row.id }, message: 'Reemplazo registrado: las lecturas siguientes se comparan con el tablero nuevo' };
  };

  anularLectura = async ({ id, reason, caller_profile, caller_user }) => {
    assertAdmin(caller_profile, 'anular lecturas');
    if (!id) throw badRequest("Campo requerido: 'id'");
    if (!reason || !String(reason).trim()) throw badRequest('Indica por qué se anula la lectura.');
    const [row] = await this.query('fleetVoidReading', { id: Number(id), voided_by: caller_user || null, void_reason: String(reason).trim().slice(0, 250) });
    if (!row) throw notFound(`Lectura con id ${id} no encontrada o ya anulada`);
    await this.evento(row.unit_id, `Lectura anulada: ${fmt(row.value, row.meter)}`, String(reason).trim(), caller_user);
    return { statusCode: STATUS_CODES.OK, message: 'Lectura anulada (queda en el historial tachada)' };
  };

  /** Guarda la lectura del GPS como maximo una vez al dia (la llama Ficha.obtener). */
  registrarLecturaGps = async (unit_id, km, fechaGps) => {
    if (!km) return;
    const vivas = (await this.query('fleetListReadings', { unit_id: Number(unit_id) })).filter((r) => r.meter === 'KM' && !r.voided_at);
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
    if (vivas.some((r) => r.source === 'GPS' && new Date(r.read_at).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' }) === hoy)) return;
    const { ultima } = await this.ultimaDeSerie(unit_id, 'KM');
    if (ultima && Number(km) < Number(ultima.value)) return; // no romper la serie con un dato menor
    const fecha = toIso(fechaGps ? `${String(fechaGps).slice(0, 19)}-04:00` : null) || new Date().toISOString();
    await this.query('fleetInsertReading', { unit_id: Number(unit_id), meter: 'KM', value: String(km), read_at: fecha, source: vivas.length ? 'GPS' : 'BASE', note: 'Leído del GPS (API ForesightFlexAPIv3)', created_by: 'GPS' });
  };
}

export default Lectura;
