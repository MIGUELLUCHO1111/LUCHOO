import Config from '../../../../config/config.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// El perfil 'admin' siempre tiene acceso a todos los proyectos -- igual que
// en el resto del sistema, no necesita fila en project_profile_assignment.
const ADMIN_PROFILE = 'admin';

// Lanza si `caller_profile` no tiene asignado `project_id` en
// project_profile_assignment. Usar en cualquier método de Control de Horas
// que lea o escriba datos de UN proyecto puntual (el `id` que llega en el
// body de la petición no es suficiente por sí solo -- hace falta esta
// segunda capa porque el modelo de permisos general es por método, no por
// fila/proyecto).
export async function assertProjectAccess(dbms, { caller_profile, project_id }) {
  if (!caller_profile || caller_profile === ADMIN_PROFILE) return;

  const result = await dbms.executeNamedQuery({
    nameQuery: 'hasProjectProfileAccess',
    params: { project_id, profile: caller_profile },
  });

  if (!result?.rows?.[0]?.allowed) {
    throw new Error(JSON.stringify({
      message: 'No tienes acceso a este proyecto',
      statusCode: STATUS_CODES.FORBIDDEN,
    }));
  }
}

// Ids de proyecto visibles para `caller_profile` -- `null` significa "todos"
// (admin, o llamada interna sin perfil), útil para filtrar listados.
export async function getAccessibleProjectIds(dbms, caller_profile) {
  if (!caller_profile || caller_profile === ADMIN_PROFILE) return null;

  const result = await dbms.executeNamedQuery({
    nameQuery: 'getAccessibleProjectIdsForProfile',
    params: { profile: caller_profile },
  });

  return (result?.rows || []).map((r) => r.project_id);
}
