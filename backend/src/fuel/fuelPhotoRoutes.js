import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import DBMS from '../dbms/dbms.js';
import Config from '../../config/config.js';
import Security from '../security/security.js';

// Ruta aparte del dispatcher JSON (mismo espíritu que src/session/sessionRoutes.js):
// la subida de fotos necesita multipart/form-data real, no encaja en el
// esquema {transaction_id, data} de una sola ruta.

const router = express.Router();
const config = new Config();
const security = new Security();
const { STATUS_CODES } = config;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads/fuel');

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!MIME_EXT[file.mimetype]) {
      return cb(new Error('INVALID_MIME'));
    }
    cb(null, true);
  },
});

const CREATE_METHOD = { carga: 'createCarga', pesada: 'createPesada' };
const UPDATE_METHOD = { carga: 'updateCarga', pesada: 'updatePesada' };
const CLASS_NAME = { carga: 'Carga', pesada: 'Pesada' };

const getDbms = async () => {
  const dbms = new DBMS();
  await dbms.init();
  return dbms;
};

// POST /fuel/photos — sube la foto de un llenado (Liviana o Pesada).
router.post('/photos', (req, res) => {
  upload.single('photo')(req, res, async (uploadErr) => {
    if (uploadErr) {
      const message =
        uploadErr.message === 'INVALID_MIME'
          ? 'Tipo de archivo no permitido (solo jpg, png o webp)'
          : uploadErr.message || 'Error al procesar el archivo';
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ statusCode: STATUS_CODES.BAD_REQUEST, message });
    }

    try {
      if (!req.user) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({
          statusCode: STATUS_CODES.UNAUTHORIZED,
          message: config.getMessage('es', 'session_required'),
        });
      }

      const { target_type: targetType, target_id: targetId, profile } = req.body || {};
      if (!CREATE_METHOD[targetType] || !targetId || !profile) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          statusCode: STATUS_CODES.BAD_REQUEST,
          message: "Campos requeridos: 'target_type' ('carga'|'pesada'), 'target_id', 'profile'",
        });
      }
      if (!req.file) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          statusCode: STATUS_CODES.BAD_REQUEST,
          message: "Falta el archivo 'photo'",
        });
      }

      const targetIdNum = parseInt(targetId, 10);
      if (!Number.isInteger(targetIdNum)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          statusCode: STATUS_CODES.BAD_REQUEST,
          message: "'target_id' inválido",
        });
      }

      if (
        !security.hasUserProfile(req.user.id, profile) ||
        !security.hasPermission({
          sub_system: 'Fuel',
          class: CLASS_NAME[targetType],
          method: CREATE_METHOD[targetType],
          profile,
        })
      ) {
        return res.status(STATUS_CODES.FORBIDDEN).json({
          statusCode: STATUS_CODES.FORBIDDEN,
          message: config.getMessage('es', 'forbidden'),
        });
      }

      const dbms = await getDbms();
      const checkQuery = targetType === 'carga' ? 'checkCargaExists' : 'checkPesadaExists';
      const existsResult = await dbms.executeNamedQuery({
        nameQuery: checkQuery,
        params: { id: targetIdNum },
      });
      if (!existsResult?.rows?.[0]) {
        return res.status(STATUS_CODES.NOT_FOUND).json({
          statusCode: STATUS_CODES.NOT_FOUND,
          message: `${CLASS_NAME[targetType]} con id ${targetIdNum} no encontrada`,
        });
      }

      const ext = MIME_EXT[req.file.mimetype];
      const dir = path.join(UPLOADS_ROOT, targetType, String(targetIdNum));
      await fs.mkdir(dir, { recursive: true });
      const filename = `${randomUUID()}${ext}`;
      await fs.writeFile(path.join(dir, filename), req.file.buffer);
      const url = `/fuel/photos/file/${targetType}/${targetIdNum}/${filename}`;

      const insertResult = await dbms.executeNamedQuery({
        nameQuery: 'insertFuelFoto',
        params: {
          refuel_id: targetType === 'carga' ? targetIdNum : null,
          pesada_id: targetType === 'pesada' ? targetIdNum : null,
          url,
          thumbnail_url: null,
          mime_type: req.file.mimetype,
          size_bytes: req.file.size,
          uploaded_by: req.user.id,
        },
      });

      return res.status(STATUS_CODES.CREATED).json({
        statusCode: STATUS_CODES.CREATED,
        data: insertResult?.rows?.[0],
        message: 'Foto subida exitosamente',
      });
    } catch (error) {
      console.error('Error subiendo foto de combustible:', error);
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        statusCode: STATUS_CODES.INTERNAL_SERVER_ERROR,
        message: config.getMessage('es', 'server_error'),
      });
    }
  });
});

// DELETE /fuel/photos/:id?profile=admin — borra una foto (fila + archivo).
router.delete('/photos/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({
        statusCode: STATUS_CODES.UNAUTHORIZED,
        message: config.getMessage('es', 'session_required'),
      });
    }

    const id = parseInt(req.params.id, 10);
    const profile = req.query.profile;
    if (!Number.isInteger(id) || !profile) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        statusCode: STATUS_CODES.BAD_REQUEST,
        message: "Campos requeridos: 'id' (parámetro de ruta), 'profile' (query string)",
      });
    }

    const dbms = await getDbms();
    const fotoResult = await dbms.executeNamedQuery({ nameQuery: 'getFuelFotoById', params: { id } });
    const foto = fotoResult?.rows?.[0];
    if (!foto) {
      return res.status(STATUS_CODES.NOT_FOUND).json({
        statusCode: STATUS_CODES.NOT_FOUND,
        message: `Foto con id ${id} no encontrada`,
      });
    }

    const targetType = foto.refuel_id != null ? 'carga' : 'pesada';

    if (
      !security.hasUserProfile(req.user.id, profile) ||
      !security.hasPermission({
        sub_system: 'Fuel',
        class: CLASS_NAME[targetType],
        method: UPDATE_METHOD[targetType],
        profile,
      })
    ) {
      return res.status(STATUS_CODES.FORBIDDEN).json({
        statusCode: STATUS_CODES.FORBIDDEN,
        message: config.getMessage('es', 'forbidden'),
      });
    }

    await dbms.executeNamedQuery({ nameQuery: 'deleteFuelFoto', params: { id } });

    try {
      const relative = foto.url.replace(/^\/fuel\/photos\/file\//, '');
      const filePath = path.resolve(UPLOADS_ROOT, relative);
      if (filePath === UPLOADS_ROOT || filePath.startsWith(UPLOADS_ROOT + path.sep)) {
        await fs.unlink(filePath);
      }
    } catch (unlinkErr) {
      console.warn('No se pudo borrar el archivo de la foto:', unlinkErr.message);
    }

    return res.json({ statusCode: STATUS_CODES.OK, message: 'Foto eliminada' });
  } catch (error) {
    console.error('Error eliminando foto de combustible:', error);
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: STATUS_CODES.INTERNAL_SERVER_ERROR,
      message: config.getMessage('es', 'server_error'),
    });
  }
});

// GET /fuel/photos/file/:targetType/:targetId/:filename — sirve el archivo,
// solo a usuarios con sesión (no es un express.static público).
router.get('/photos/file/:targetType/:targetId/:filename', async (req, res) => {
  if (!req.user) {
    return res.status(STATUS_CODES.UNAUTHORIZED).json({
      statusCode: STATUS_CODES.UNAUTHORIZED,
      message: config.getMessage('es', 'session_required'),
    });
  }

  const { targetType, targetId, filename } = req.params;
  if (
    !['carga', 'pesada'].includes(targetType) ||
    !SAFE_SEGMENT.test(targetId) ||
    !SAFE_SEGMENT.test(filename)
  ) {
    return res.status(STATUS_CODES.BAD_REQUEST).json({
      statusCode: STATUS_CODES.BAD_REQUEST,
      message: 'Ruta de archivo inválida',
    });
  }

  const filePath = path.resolve(UPLOADS_ROOT, targetType, targetId, filename);
  if (filePath !== UPLOADS_ROOT && !filePath.startsWith(UPLOADS_ROOT + path.sep)) {
    return res.status(STATUS_CODES.FORBIDDEN).json({
      statusCode: STATUS_CODES.FORBIDDEN,
      message: config.getMessage('es', 'forbidden'),
    });
  }

  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(STATUS_CODES.NOT_FOUND).json({
        statusCode: STATUS_CODES.NOT_FOUND,
        message: 'Archivo no encontrado',
      });
    }
  });
});

export default router;
