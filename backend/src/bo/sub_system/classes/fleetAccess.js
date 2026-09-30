import Config from '../../../../config/config.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Acceso a las unidades de Flota (respuestas de Julio, 30/09/2026): el admin
// edita todo; un encargado de flota solo SUS unidades (las que tiene
// asignadas en fleet_unit_manager). Se llama en TODAS las funciones que
// modifican una unidad -- mismo espiritu que assertProjectAccess de Horas,
// que se encontro faltando en varias funciones.
//
// caller_profile / caller_user_id los pone el dispatcher despues de validar
// la sesion; si no vienen (llamada interna del backend, ej. un cron) no se
// restringe, igual que en Horas.

export const ADMIN_PROFILE = 'admin';

export const isAdminCaller = (caller_profile) => !caller_profile || String(caller_profile).toLowerCase() === ADMIN_PROFILE;

const forbidden = (message) => new Error(JSON.stringify({ message, statusCode: STATUS_CODES.FORBIDDEN }));

export async function canEditUnit(dbms, { caller_profile, caller_user_id, unit_id }) {
  if (isAdminCaller(caller_profile)) return true;
  if (!caller_user_id || !unit_id) return false;
  const result = await dbms.executeNamedQuery({ nameQuery: 'fleetIsUnitManager', params: { unit_id: Number(unit_id), user_id: Number(caller_user_id) } });
  return !!result?.rows?.[0]?.ok;
}

export async function assertUnitAccess(dbms, ctx) {
  if (!(await canEditUnit(dbms, ctx))) {
    throw forbidden('Solo puedes modificar las unidades que tienes asignadas como encargado.');
  }
}

export function assertAdmin(caller_profile, what = 'hacer este cambio') {
  if (!isAdminCaller(caller_profile)) throw forbidden(`Solo un administrador puede ${what}.`);
}
