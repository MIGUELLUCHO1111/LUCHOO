import express from 'express';
import Dispatcher from '../src/dispatcher/dispatcher.js';
import Config from '../config/config.js';

const router = express.Router();
const config = new Config();

/**
 * Endpoint público para procesar solicitudes autorizadas
 * POST /dispatcher
 * Body: {
 *   permission: {
 *     sub_system: string,
 *     class: string,
 *     method: string,
 *     profile: string,
 *     parameter: object
 *   },
 *   lang?: string
 * }
 */
router.post('/', async (req, res) => {
  try {
    // Validar que exista el objeto permission
    if (!req.body || !req.body.permission) {
      return res.status(400).json({
        statusCode: config.STATUS_CODES.BAD_REQUEST,
        message:
          config.getMessage(req?.body?.lang, 'missing_required_fields') ||
          'Permission object is required',
        error: 'Missing permission in request body',
      });
    }

    // Validar campos requeridos en permission
    const { permission } = req.body;
    const requiredFields = ['sub_system', 'class', 'method', 'profile'];
    const missingFields = requiredFields.filter((field) => !permission[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        statusCode: config.STATUS_CODES.BAD_REQUEST,
        message:
          config.getMessage(req?.body?.lang, 'missing_required_fields') ||
          'Missing required fields',
        error: `Missing required fields: ${missingFields.join(', ')}`,
      });
    }

    // Procesar la solicitud a través del Dispatcher
    const dispatcher = new Dispatcher();
    const result = await dispatcher.toProccess(req);

    // Manejar diferentes tipos de respuestas
    if (typeof result === 'string') {
      // Respuesta de tipo mensaje (error de sesión, etc.)
      return res.status(401).json({
        statusCode: config.STATUS_CODES.UNAUTHORIZED,
        message: result,
      });
    }

    if (result.statusCode && result.statusCode !== 200) {
      // Respuesta con error
      return res.status(result.statusCode).json({
        statusCode: result.statusCode,
        message: result.message,
        error: result.error || null,
      });
    }

    // Respuesta exitosa
    return res.status(200).json({
      statusCode: 200,
      message: result.message || 'Operation completed successfully',
      data: result.data || null,
    });
  } catch (error) {
    console.error('Error in dispatcher endpoint:', error);
    return res.status(500).json({
      statusCode: config.STATUS_CODES.INTERNAL_SERVER_ERROR,
      message:
        config.getMessage(req?.body?.lang, 'server_error') ||
        'Internal server error',
      error: error.message,
    });
  }
});

/**
 * Endpoint para verificar el estado del Dispatcher
 * GET /dispatcher/status
 */
router.get('/status', (req, res) => {
  try {
    return res.status(200).json({
      statusCode: 200,
      message: 'Dispatcher service is running',
      timestamp: new Date().toISOString(),
      service: 'DispatcherService',
    });
  } catch (error) {
    return res.status(500).json({
      statusCode: config.STATUS_CODES.INTERNAL_SERVER_ERROR,
      message: 'Error checking dispatcher status',
      error: error.message,
    });
  }
});

/**
 * Endpoint para verificar permisos sin ejecutar el método
 * POST /dispatcher/check-permission
 */
router.post('/check-permission', async (req, res) => {
  try {
    if (!req.body || !req.body.permission) {
      return res.status(400).json({
        statusCode: config.STATUS_CODES.BAD_REQUEST,
        message: 'Permission object is required',
        error: 'Missing permission in request body',
      });
    }

    const dispatcher = new Dispatcher();
    const security = dispatcher.security;

    // Verificar si el permiso existe
    const hasPermission = security.hasPermission(req.body.permission);

    return res.status(200).json({
      statusCode: 200,
      message: 'Permission check completed',
      hasPermission: hasPermission,
      permission: req.body.permission,
    });
  } catch (error) {
    return res.status(500).json({
      statusCode: config.STATUS_CODES.INTERNAL_SERVER_ERROR,
      message: 'Error checking permission',
      error: error.message,
    });
  }
});

export default router;
