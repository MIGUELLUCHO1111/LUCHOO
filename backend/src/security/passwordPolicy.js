// Política de contraseñas (seguridad, 08/10/2026). Se valida en el SERVIDOR:
// antes solo la pantalla pedía 6 caracteres y cualquiera podía saltársela
// llamando a la API directo.
//
// Regla: al menos 8 caracteres y al menos 3 de estos 4 tipos: mayúscula,
// minúscula, número y símbolo. (La pantalla de Usuarios aplica la misma
// regla, en frontend/src/lib/passwordPolicy.js, para avisar antes de enviar.)
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RULE_TEXT =
  'La contraseña debe tener al menos 8 caracteres y combinar al menos 3 de estos: mayúscula, minúscula, número y símbolo.';

export function passwordProblem(password) {
  const p = String(password ?? '');
  if (p.length < PASSWORD_MIN_LENGTH) return PASSWORD_RULE_TEXT;
  const kinds = [/[A-ZÁÉÍÓÚÑ]/, /[a-záéíóúñ]/, /[0-9]/, /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/].filter((re) => re.test(p)).length;
  return kinds >= 3 ? null : PASSWORD_RULE_TEXT;
}
