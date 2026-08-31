// Validación anti-XSS del lado del cliente (solo tags/protocolo javascript:).
// No bloquea palabras clave SQL: el backend ya parametriza las queries, así
// que ese filtro solo generaba falsos positivos sin aportar seguridad real.
export const SecurityRules = {
  dangerousPatterns: /<script\b|<iframe\b|javascript:|on\w+\s*=/i,

  isSafe: (val) => {
    if (!val) return true;
    return !SecurityRules.dangerousPatterns.test(val);
  },
};
