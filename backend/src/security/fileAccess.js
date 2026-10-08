import Security from './security.js';

// Permiso para DESCARGAR un archivo (seguridad, 08/10/2026).
//
// Antes, las rutas que sirven archivos (fotos de combustible, documentos y
// fotos de Flota, reportes y adjuntos del Tracker) solo pedían tener una
// sesión: cualquier usuario logueado, aunque su perfil no tuviera esa
// sección, podía bajar cualquier archivo si conocía o adivinaba la URL.
//
// Ahora se exige que ALGUNO de los perfiles del usuario tenga permiso para
// alguna de las funciones que muestran ese archivo en la app (las mismas que
// usa la pantalla). Se revisan todos sus perfiles porque las URL de archivo
// las pide el navegador (<img>, enlaces) y no llevan el perfil activo.
//
// rules: [{ sub_system, class, methods: [...] }, ...]
export function userCanAny(req, rules) {
  if (!req?.user?.id) return false;
  const security = new Security();
  const profiles = security.userProfiles?.get(String(req.user.id).trim().toLowerCase());
  if (!profiles?.size) return false;
  for (const profile of profiles) {
    for (const rule of rules) {
      for (const method of rule.methods) {
        if (security.hasPermission({ sub_system: rule.sub_system, class: rule.class, method, profile })) return true;
      }
    }
  }
  return false;
}

// Respuesta estándar cuando no tiene permiso (401 si ni siquiera hay sesión).
export function denyFile(req, res) {
  const code = req?.user ? 403 : 401;
  return res.status(code).json({
    statusCode: code,
    message: req?.user ? 'No tienes permiso para ver este archivo.' : 'Se requiere sesión para acceder a este recurso',
  });
}
