// Política de contraseñas (seguridad, 08/10/2026): MISMA regla que valida el
// servidor (backend/src/security/passwordPolicy.js). Aquí solo sirve para
// avisar en la pantalla antes de enviar; el servidor es quien la exige.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RULE_TEXT =
  'La contraseña debe tener al menos 8 caracteres y combinar al menos 3 de estos: mayúscula, minúscula, número y símbolo.';

export function passwordProblem(password) {
  const p = String(password ?? '');
  if (p.length < PASSWORD_MIN_LENGTH) return PASSWORD_RULE_TEXT;
  const kinds = [/[A-ZÁÉÍÓÚÑ]/, /[a-záéíóúñ]/, /[0-9]/, /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/].filter((re) => re.test(p)).length;
  return kinds >= 3 ? null : PASSWORD_RULE_TEXT;
}
