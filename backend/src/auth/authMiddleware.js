import Tokenizer from '../tokenizer/tokenizer.js';
import { TOKEN_EXPIRES_IN, REFRESHED_TOKEN_HEADER, REFRESH_AFTER_SECONDS } from '../session/sessionPolicy.js';
import { touchUser } from '../security/activityTracker.js';
import { clientIp } from '../utils/clientIp.js';

const tokenizer = new Tokenizer();

/**
 * Middleware de autenticación agnóstico:
 *   1. Authorization: Bearer <JWT>  → apps nativas / integraciones
 *   2. Cookie de sesión (express-session) → web
 *
 * Deja el usuario en req.user (o null si no hay credenciales válidas).
 * No bloquea la petición: cada endpoint decide qué hacer sin auth.
 */
export default function authMiddleware(req, res, next) {
  req.user = null;
  resolveUser(req, res);
  // Actividad de usuarios (066): cualquier petición con sesión cuenta como
  // "está usando el sistema" (se guarda por lotes, ver activityTracker.js).
  if (req.user?.id != null) touchUser(req.user.id, clientIp(req));
  return next();
}

function resolveUser(req, res) {

  // 1. Bearer token
  const authHeader = req.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = token ? tokenizer.verifyToken(token) : null;
    if (payload?.userId != null) {
      req.user = { id: payload.userId, username: payload.username, via: 'token' };
      // Cierre por inactividad (08/10/2026): cada petición con un pase de más
      // de 1 minuto recibe uno nuevo de 30 minutos (ver session/sessionPolicy.js).
      // La pantalla lo guarda (interceptor de api.js). Así solo vence si pasan
      // 30 minutos sin ninguna petición.
      const ageSeconds = Math.floor(Date.now() / 1000) - (payload.iat || 0);
      if (ageSeconds >= REFRESH_AFTER_SECONDS) {
        res.setHeader(
          REFRESHED_TOKEN_HEADER,
          tokenizer.generateToken({ userId: payload.userId, username: payload.username }, TOKEN_EXPIRES_IN),
        );
      }
    }
    return;
  }

  // 2. Cookie de sesión
  const sessionUser = req?.session?.data?.user;
  if (sessionUser) {
    req.user = { ...sessionUser, via: 'session' };
  }
}
