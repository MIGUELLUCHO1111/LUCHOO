// IP real del cliente, sin puerto.
//
// Azure App Service reenvía X-Forwarded-For como "ip:puerto" (ej.
// "190.6.1.20:51234"; IPv6 como "[2800::1]:51234"), y Express lo toma tal
// cual en req.ip cuando 'trust proxy' está activo. El puerto cambia en cada
// conexión, así que el rate limit de login (que cuenta intentos por IP) vería
// a cada intento como una persona distinta y nunca bloquearía. Aquí se le
// quita el puerto; una IP sin puerto (desarrollo, Container Apps) queda igual.
export function clientIp(req) {
  const raw = String(req.ip || req.socket?.remoteAddress || '').trim();
  const bracketed = raw.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) return bracketed[1];
  const ipv4WithPort = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) return ipv4WithPort[1];
  return raw;
}
