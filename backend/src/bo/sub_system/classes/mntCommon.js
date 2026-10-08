import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';

// Reglas comunes de Mantenimiento (062_maintenance.sql, política
// FP-MTTO-PO-01). Decisiones de Julio, 07/10/2026:
//   - toda la flota entra;
//   - niveles de aprobación de la política (§9.4) desde ya;
//   - perfiles: mantenimiento (crea y ejecuta), supervisor_mantenimiento
//     (aprueba correctivas menores y valida cierres) y gerencia (aprueba
//     mayores y regulariza emergencias). admin puede todo.
//   - correctiva MAYOR = equipo crítico, compra especial o costo estimado
//     >= CORRECTIVA_MAYOR_UMBRAL_USD (sin valor hasta que lo fije Gerencia
//     con Finanzas: mientras tanto decide solo la criticidad).
//   - la mayor necesita dos firmas de usuarios distintos: Gerencia de
//     Mantenimiento y Gerencia de Operaciones.

const config = new Config();
export const STATUS_CODES = config.STATUS_CODES;

const err = (statusCode) => (message) => new Error(JSON.stringify({ message, statusCode }));
export const badRequest = err(STATUS_CODES.BAD_REQUEST);
export const forbidden = err(STATUS_CODES.FORBIDDEN);
export const notFound = err(STATUS_CODES.NOT_FOUND);
export const conflict = err(STATUS_CODES.CONFLICT || 409);

export const KINDS = ['PREVENTIVA', 'CORRECTIVA', 'EMERGENCIA'];
export const PRIORITIES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];
export const FAILURE_SYSTEMS = ['MECANICO', 'HIDRAULICO', 'ELECTRICO', 'ESTRUCTURAL', 'OPERADOR', 'OTRO'];
export const CRIT_LEVELS = ['CRITICO', 'SEMICRITICO', 'NO_CRITICO'];
export const TERMINAL = ['CERRADA', 'RECHAZADA', 'ANULADA'];
export const ACTIVE_WORK = ['APROBADA', 'EN_EJECUCION', 'ESPERA_REPUESTO'];

export const STATUS_LABEL = {
  SOLICITADA: 'Solicitada', APROBADA: 'Aprobada', EN_EJECUCION: 'En ejecución', ESPERA_REPUESTO: 'Espera de repuesto',
  EJECUTADA: 'Ejecutada', CERRADA: 'Cerrada', RECHAZADA: 'Rechazada', ANULADA: 'Anulada',
};
export const ROLE_LABEL = { SUPERVISOR: 'Supervisor de Mantenimiento', GERENCIA_MTTO: 'Gerencia de Mantenimiento', GERENCIA_OPS: 'Gerencia de Operaciones' };

const profileOf = (p) => String(p || '').toLowerCase();
export const isAdmin = (p) => !p || profileOf(p) === 'admin'; // sin perfil = llamada interna del backend
export const isGerencia = (p) => isAdmin(p) || profileOf(p) === 'gerencia';
export const isSupervisor = (p) => isGerencia(p) || profileOf(p) === 'supervisor_mantenimiento';

// Firmas que puede dar cada perfil (la gerencia y el admin cubren también la del supervisor).
export const rolesFor = (p) => (isGerencia(p) ? ['SUPERVISOR', 'GERENCIA_MTTO', 'GERENCIA_OPS'] : isSupervisor(p) ? ['SUPERVISOR'] : []);

// Firmas que necesita la OT para pasar a APROBADA.
export const requiredRoles = (wo) => {
  if (wo.kind === 'CORRECTIVA') return wo.level === 'MAYOR' ? ['GERENCIA_MTTO', 'GERENCIA_OPS'] : ['SUPERVISOR'];
  return []; // preventiva: aprobada por el plan; emergencia: se ejecuta y se regulariza
};

export const computeLevel = ({ criticality, estimatedCost, specialPurchase, threshold }) => {
  if (criticality === 'CRITICO' || specialPurchase) return 'MAYOR';
  if (threshold != null && estimatedCost != null && Number(estimatedCost) >= Number(threshold)) return 'MAYOR';
  return 'MENOR';
};

export const levelReason = ({ criticality, estimatedCost, specialPurchase, threshold }) => {
  if (criticality === 'CRITICO') return 'equipo crítico';
  if (specialPurchase) return 'requiere compra especial / repuesto importado';
  if (threshold != null && estimatedCost != null && Number(estimatedCost) >= Number(threshold)) return `costo estimado mayor o igual a ${threshold} USD`;
  return null;
};

export const text = (v, max = 300) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

export const amount = (v, label) => {
  if (v === undefined) return undefined;
  if (v === null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw badRequest(`${label} debe ser un número mayor o igual a 0.`);
  return n;
};

export const oneOf = (v, list, label) => {
  if (v === undefined || v === null || v === '') return v === '' ? null : v;
  const s = String(v).toUpperCase();
  if (!list.includes(s)) throw badRequest(`${label} inválido.`);
  return s;
};

export class MntBase {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  query = async (nameQuery, params = {}) => {
    await this.dbmsReady;
    const result = await this.dbms.executeNamedQuery({ nameQuery, params });
    return result?.rows || [];
  };

  settings = async () => {
    const rows = await this.query('mntGetSettings');
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const num = (k, def) => (map[k] === null || map[k] === undefined || map[k] === '' ? def : Number(map[k]));
    return {
      threshold: num('CORRECTIVA_MAYOR_UMBRAL_USD', null),
      regularizeHours: num('EMERGENCIA_REGULARIZAR_HORAS', 48),
      staleDays: num('OT_ESTANCADA_DIAS', 15),
    };
  };

  unitCriticality = async (unit_id) => (await this.query('mntGetUnitCriticality', { unit_id: Number(unit_id) }))[0]?.level || 'NO_CRITICO';

  fleetEvent = (unit_id, title, detail, who) =>
    this.query('fleetInsertEvent', { unit_id: Number(unit_id), event_type: 'MANTENIMIENTO', title, detail: detail || null, created_by: who || null });

  woEvent = (work_order_id, title, detail, who) =>
    this.query('mntInsertEvent', { work_order_id: Number(work_order_id), title, detail: detail || null, created_by: who || null });

  // ---------- Condición operativa de la unidad (ficha de Flota) ----------
  // Al abrir una OT con la unidad parada se marca "Fuera de servicio" con
  // causa "En mantenimiento (OT-xx)" y se guarda la condición anterior; al
  // cerrarla, rechazarla o anularla se devuelve, salvo que otra OT abierta
  // la siga teniendo parada.
  markOutOfService = async (wo, who) => {
    const [unit] = await this.query('mntGetUnit', { id: Number(wo.unit_id) });
    const prev = unit?.operational_status || 'DISPONIBLE';
    await this.query('mntSetPrevStatus', { id: Number(wo.id), prev_status: prev, prev_cause: unit?.status_cause || null });
    const cause = `En mantenimiento (${wo.number})`;
    if (prev !== 'FUERA_DE_SERVICIO' || !String(unit?.status_cause || '').startsWith('En mantenimiento')) {
      await this.query('mntSetUnitStatus', { unit_id: Number(wo.unit_id), status: 'FUERA_DE_SERVICIO', cause });
      await this.fleetEvent(wo.unit_id, `Condición: Fuera de servicio (${cause})`, `Antes: ${prev === 'OPERATIVO_CONTRATO' ? 'En contrato' : prev === 'DISPONIBLE' ? 'Disponible' : 'Fuera de servicio'}`, who);
    }
  };

  releaseUnit = async (wo, who) => {
    if (!wo.out_of_service) return;
    const [{ n }] = await this.query('mntOtherOpenOutOfService', { unit_id: Number(wo.unit_id), exclude_id: Number(wo.id) });
    if (n > 0) return; // otra OT abierta la sigue teniendo parada
    const [unit] = await this.query('mntGetUnit', { id: Number(wo.unit_id) });
    if (unit?.operational_status !== 'FUERA_DE_SERVICIO' || !String(unit?.status_cause || '').startsWith('En mantenimiento')) return; // alguien la cambió a mano
    const back = wo.prev_operational_status && wo.prev_operational_status !== 'FUERA_DE_SERVICIO' ? wo.prev_operational_status : (wo.prev_operational_status === 'FUERA_DE_SERVICIO' && wo.prev_status_cause && !wo.prev_status_cause.startsWith('En mantenimiento') ? 'FUERA_DE_SERVICIO' : 'DISPONIBLE');
    const cause = back === 'FUERA_DE_SERVICIO' ? wo.prev_status_cause : null;
    await this.query('mntSetUnitStatus', { unit_id: Number(wo.unit_id), status: back, cause });
    const label = back === 'OPERATIVO_CONTRATO' ? 'En contrato' : back === 'DISPONIBLE' ? 'Disponible' : `Fuera de servicio (${cause})`;
    await this.fleetEvent(wo.unit_id, `Condición: ${label}`, `Liberada al terminar ${wo.number}`, who);
  };
}
