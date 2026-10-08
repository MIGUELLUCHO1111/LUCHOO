import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { clientIp } from '../utils/clientIp.js';
import { TOKEN_EXPIRES_IN, SESSION_IDLE_MINUTES } from './sessionPolicy.js';
import { recordSessionEvent } from '../security/activityTracker.js';
import { passwordProblem } from '../security/passwordPolicy.js';
import pool from '../../config/db.js';
import PgRateLimitStore from '../security/pgRateLimitStore.js';
const router = express.Router();
import Session from './session.js';
const session = new Session();
import SessionWrapper from './sessionWrapper.js';
import Security from '../security/security.js';
const sessionWrapper = new SessionWrapper();
import Validator from '../../utils/validator.js';
const validator = new Validator();

import Config from '../../config/config.js';
const config = new Config();
const getMessage = config.getMessage.bind(config);
const { STATUS_CODES } = config;
import Tokenizer from '../tokenizer/tokenizer.js';
const tokenizer = new Tokenizer();

// Limita intentos en rutas sensibles (login/registro/recuperación de contraseña).
// Store en Postgres (no MemoryStore): el conteo es el mismo sin importar qué
// proceso de PM2 cluster atienda la petición. Un limiter por ruta (con
// keyGenerator con prefijo) para que agotar el cupo de una no bloquee las
// otras tres -- antes compartían un solo contador por IP.
function createAuthLimiter(routeName) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: new PgRateLimitStore(),
    // clientIp quita el puerto que agrega Azure App Service (ver utils/clientIp.js);
    // la validación de req.ip de la librería se apaga porque justamente ese
    // puerto la haría quejarse en cada petición.
    keyGenerator: (req) => `${routeName}:${ipKeyGenerator(clientIp(req))}`,
    validate: { ip: false },
    message: { error: 'Demasiados intentos, intente de nuevo más tarde' },
  });
}

const registerLimiter = createAuthLimiter('register');
const loginLimiter = createAuthLimiter('login');

// Registro de usuario
router.post('/register', registerLimiter, async (req, res) => {
  // Seguridad (08/10/2026): antes cualquiera, sin sesión, podía crearse un
  // usuario. La app no usa esta ruta (los usuarios se crean en Seguridad →
  // Usuarios, con su permiso); queda solo para un administrador logueado.
  if (!req.user || !new Security().hasUserProfile(req.user.id, 'admin')) {
    return res.status(STATUS_CODES.FORBIDDEN).json({ message: 'Solo un administrador puede registrar usuarios.' });
  }
  try {
    // Schema de validación para registro
    const registerSchema = {
      username: {
        type: 'string',
        options: { required: true },
      },
      password: {
        type: 'string',
        options: {
          required: true,
          requireSpecialChars: true,
        },
      },
      person_id: {
        type: 'number',
        options: { required: true },
      },
    };

    // Validar todos los campos
    const validation = validator.validateObject(req.body, registerSchema);
    if (!validation.isValid) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        message: getMessage(config.LANGUAGE, 'validation_error'),
        errors: validation.errors,
      });
    }

    const weak = passwordProblem(req.body?.password);
    if (weak) return res.status(STATUS_CODES.BAD_REQUEST).json({ message: weak });

    const userData = await session.register(req.body);
    sessionWrapper.setSession(req, { user: userData });
    res.json({
      message: getMessage(config.LANGUAGE, 'registration_success'),
      user: userData,
    });
  } catch (error) {
    res.status(STATUS_CODES.BAD_REQUEST).json({
      message:
        error.message || getMessage(config.LANGUAGE, 'registration_error'),
      error,
    });
  }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    // El login solo verifica que vengan usuario y contraseña no vacíos.
    // No se reutiliza el validador de "password" (longitud/mayúsculas/
    // números): esa es una regla para cuando se ESTABLECE una contraseña
    // (registro, reset), no para cuando se verifica una ya existente — si no,
    // una cuenta creada con una contraseña más corta/simple (ej. desde el
    // panel de Usuarios, que solo pide 6 caracteres) nunca podría iniciar
    // sesión aunque la contraseña sea la correcta.
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        message: getMessage(config.LANGUAGE, 'validation_error'),
        errors: {
          ...(!username ? { username: 'El campo username es obligatorio' } : {}),
          ...(!password ? { password: 'El campo password es obligatorio' } : {}),
        },
      });
    }

    const userData = await session.login(req.body);
    const ip = clientIp(req);
    const userAgent = req.headers['user-agent'];
    if (!userData) {
      // Auditoría (066): intento fallido. Si el usuario existe pero está
      // eliminado o desactivado se marca aparte (LOGIN_BLOCKED). El mensaje al
      // usuario es el mismo en ambos casos, para no revelar qué cuentas existen.
      const blocked = await pool
        .query('SELECT id FROM public."user" WHERE name = $1 AND (deleted_at IS NOT NULL OR is_active = false) LIMIT 1', [username])
        .then((r) => r.rows[0]?.id || null)
        .catch(() => null);
      await recordSessionEvent({ userId: blocked, username, event: blocked ? 'LOGIN_BLOCKED' : 'LOGIN_FAIL', ip, userAgent });
      return res
        .status(STATUS_CODES.UNAUTHORIZED)
        .json({ error: getMessage(config.LANGUAGE, 'login_error') });
    }
    sessionWrapper.setSession(req, { user: userData });
    await recordSessionEvent({ userId: userData.id, username: userData.username, event: 'LOGIN_OK', ip, userAgent });

    // Token para clientes sin cookies (apps nativas / integraciones)
    const token = tokenizer.generateToken(
      { userId: userData.id, username: userData.username },
      TOKEN_EXPIRES_IN,
    );

    res.json({
      message: getMessage(config.LANGUAGE, 'login_success'),
      user: userData,
      token,
      session_idle_minutes: SESSION_IDLE_MINUTES,
    });
  } catch (error) {
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      message: getMessage(config.LANGUAGE, 'server_error'),
      error,
    });
  }
});

// Obtener usuario actual
router.get('/me', async (req, res) => {
  if (!req.user) {
    return res
      .status(STATUS_CODES.UNAUTHORIZED)
      .json({ error: getMessage(config.LANGUAGE, 'unauthorized') });
  }

  // Bearer token → cargar perfil completo desde BD (JWT lleva solo userId)
  if (req.user.via === 'token') {
    try {
      const fullUser = await session.getUserById(req.user.id);
      if (!fullUser) {
        return res
          .status(STATUS_CODES.UNAUTHORIZED)
          .json({ error: 'Usuario del token no encontrado' });
      }
      delete fullUser.password;
      return res.json({ ...fullUser, via: 'token', session_idle_minutes: SESSION_IDLE_MINUTES });
    } catch (err) {
      return res
        .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
        .json({ message: getMessage(config.LANGUAGE, 'server_error') });
    }
  }

  // Sesión web → el usuario completo ya está en la sesión, pero se confirma
  // que siga activo (seguridad 08/10/2026): si un administrador lo eliminó o
  // lo desactivó mientras tenía la sesión abierta, se le cierra aquí en vez
  // de dejarlo dentro hasta que la cookie venza.
  try {
    const stillActive = await session.getUserById(req.user.id);
    if (!stillActive) {
      await sessionWrapper.destroySession(req).catch(() => {});
      return res
        .status(STATUS_CODES.UNAUTHORIZED)
        .json({ error: 'Tu usuario fue desactivado. Inicia sesión con otra cuenta o contacta a un administrador.' });
    }
  } catch {
    return res
      .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: getMessage(config.LANGUAGE, 'server_error') });
  }
  const { password: _, ...safeUser } = req.user;
  res.json({ ...safeUser, session_idle_minutes: SESSION_IDLE_MINUTES });
});

// Recuperacion de contrasena
// "Olvidé mi contraseña" y su enlace de recuperación se quitaron (08/10/2026,
// decisión de Julio): solo un administrador cambia contraseñas, desde
// Seguridad > Usuarios. Las rutas /forgot-password y /reset-password ya no existen.

router.post('/logout', async (req, res) => {
  // Auditoría (066): la pantalla manda reason "idle" cuando cierra por inactividad.
  if (req.user?.id != null) {
    await recordSessionEvent({
      userId: req.user.id,
      username: req.user.username,
      event: req.body?.reason === 'idle' ? 'LOGOUT_IDLE' : 'LOGOUT',
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
  }
  if (!sessionWrapper.authenticate(req))
    return res
      .status(STATUS_CODES.UNAUTHORIZED)
      .json({ error: getMessage(config.LANGUAGE, 'unauthorized') });
  const result = await sessionWrapper.destroySession(req);
  return res.status(result?.statusCode || STATUS_CODES.OK).json({
    message: result?.message || getMessage(config.LANGUAGE, 'logout_success'),
  });
});

export default router;
