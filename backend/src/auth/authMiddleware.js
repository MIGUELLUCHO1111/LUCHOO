import Tokenizer from '../tokenizer/tokenizer.js';

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

  // 1. Bearer token
  const authHeader = req.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = token ? tokenizer.verifyToken(token) : null;
    if (payload?.userId != null) {
      req.user = { id: payload.userId, username: payload.username, via: 'token' };
    }
    return next();
  }

  // 2. Cookie de sesión
  const sessionUser = req?.session?.data?.user;
  if (sessionUser) {
    req.user = { ...sessionUser, via: 'session' };
  }

  return next();
}
