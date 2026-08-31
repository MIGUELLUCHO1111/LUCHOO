import express from 'express';
import rateLimit from 'express-rate-limit';
const router = express.Router();
import Session from './session.js';
const session = new Session();
import SessionWrapper from './sessionWrapper.js';
const sessionWrapper = new SessionWrapper();
import Validator from '../../utils/validator.js';
const validator = new Validator();

import Config from '../../config/config.js';
const config = new Config();
const getMessage = config.getMessage.bind(config);
const { STATUS_CODES } = config;
import Tokenizer from '../tokenizer/tokenizer.js';
import Mailer from '../mailer/mailer.js';
const tokenizer = new Tokenizer();
const mailer = new Mailer();

// Limita intentos en rutas sensibles (login/registro/recuperación de contraseña)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, intente de nuevo más tarde' },
});

// Registro de usuario
router.post('/register', authLimiter, async (req, res) => {
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
router.post('/login', authLimiter, async (req, res) => {
  try {
    // Schema de validación para login
    const loginSchema = {
      username: {
        type: 'string',
        options: { required: true },
      },
      password: {
        type: 'string',
        options: { required: true },
      },
    };

    // Validar campos de login
    const validation = validator.validateObject(req.body, loginSchema);
    if (!validation.isValid) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        message: getMessage(config.LANGUAGE, 'validation_error'),
        errors: validation.errors,
      });
    }

    const userData = await session.login(req.body);
    if (!userData)
      return res
        .status(STATUS_CODES.UNAUTHORIZED)
        .json({ error: getMessage(config.LANGUAGE, 'login_error') });
    sessionWrapper.setSession(req, { user: userData });

    // Token para clientes sin cookies (apps nativas / integraciones)
    const token = tokenizer.generateToken(
      { userId: userData.id, username: userData.username },
      process.env.AUTH_TOKEN_EXPIRES || '1h',
    );

    res.json({
      message: getMessage(config.LANGUAGE, 'login_success'),
      user: userData,
      token,
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
      return res.json({ ...fullUser, via: 'token' });
    } catch (err) {
      return res
        .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
        .json({ message: getMessage(config.LANGUAGE, 'server_error') });
    }
  }

  // Sesión web → el usuario completo ya está en la sesión
  const { password: _, ...safeUser } = req.user;
  res.json(safeUser);
});

// Recuperacion de contrasena
router.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body || {};

  await sessionWrapper.destroySession(req);

  const forgotPasswordSchema = {
    email: {
      type: 'email',
      options: { required: true },
    },
  };

  const validation = validator.validateObject(req.body, forgotPasswordSchema);
  if (!validation.isValid) {
    return res.status(STATUS_CODES.BAD_REQUEST).json({
      message: getMessage(config.LANGUAGE, 'validation_error'),
      errors: validation.errors,
    });
  }

  try {
    const userData = await session.getUserByEmail(email);
    if (userData) {
      const token = tokenizer.generateToken({
        id: userData.id,
        username: userData.username,
        email: userData.email,
      });
      const origin = process.env.FRONTEND_URL || req.headers.origin;
      await mailer.sendRecoveryEmail({
        email: userData.email,
        token,
        origin,
        username: userData.username,
      });
    }

    return res.json({
      message: config.getMessage(config.LANGUAGE, 'recovery_email_sent'),
    });
  } catch (error) {
    console.error('Error en forgot-password:', error);
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      message: config.getMessage(config.LANGUAGE, 'server_error'),
      error,
    });
  }
});

router.post('/reset-password', authLimiter, async (req, res) => {
  const { token, password, confirmPassword } = req.body || {};

  // Terminar la sesion si existe
  await sessionWrapper.destroySession(req);

  const resetPasswordSchema = {
    token: {
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
    confirmPassword: {
      type: 'string',
      options: { required: true },
    },
  };

  const validation = validator.validateObject(req.body, resetPasswordSchema);
  if (!validation.isValid) {
    return res.status(STATUS_CODES.BAD_REQUEST).json({
      message: getMessage(config.LANGUAGE, 'validation_error'),
      errors: validation.errors,
    });
  }

  if (password !== confirmPassword) {
    return res.status(STATUS_CODES.BAD_REQUEST).json({
      error: getMessage(config.LANGUAGE, 'passwords_do_not_match'),
    });
  }

  const tokenPayload = tokenizer.verifyToken(token);
  if (!tokenPayload?.id) {
    return res.status(STATUS_CODES.BAD_REQUEST).json({
      error: config.getMessage(config.LANGUAGE, 'invalid_or_expired_token'),
    });
  }

  try {
    const userData = await session.updatePasswordById({
      userId: tokenPayload.id,
      password,
    });
    if (!userData) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ error: getMessage(config.LANGUAGE, 'user_not_found') });
    }
    return res.json({
      message: getMessage(config.LANGUAGE, 'password_reset_success'),
      user: userData,
    });
  } catch (error) {
    console.error('Error en reset-password:', error);
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      message: getMessage(config.LANGUAGE, 'server_error'),
      error,
    });
  }
});
// Logout
router.post('/logout', async (req, res) => {
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
