import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import DBMS from '../dbms/dbms.js';
import Config from '../../config/config.js';
import Security from '../security/security.js';

// Ruta aparte del dispatcher JSON (mismo espíritu que fuelPhotoRoutes.js):
// anexos del reporte diario del Tracker que no vienen por la API de
// Foresight (ej. el PDF del Dashboard de Seguridad de la plataforma, que
// solo se puede exportar como imagen/PDF).

const router = express.Router();
const config = new Config();
const security = new Security();
const { STATUS_CODES } = config;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads/tracker');

const MIME_EXT = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;
const SAFE_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Los anexos se gatean con el mismo permiso que el Reporte de Turno
// (Tracker.Reporte.generarReporte) -- es la misma sección de la app, sin
// necesidad de inventar transacciones nuevas solo para el chequeo.
const REQUIRED_PERMISSION = { sub_system: 'Tracker', class: 'Reporte', method: 'generarReporte' };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!MIME_EXT[file.mimetype]) {
      return cb(new Error('INVALID_MIME'));
    }
    cb(null, true);
  },
});

const getDbms = async () => {
  const dbms = new DBMS();
  await dbms.init();
  return dbms;
};

const requireAccess = (req, res) => {
  if (!req.user) {
    res.status(STATUS_CODES.UNAUTHORIZED).json({
      statusCode: STATUS_CODES.UNAUTHORIZED,
      message: config.getMessage('es', 'session_required'),
    });
    return false;
  }
  const profile = req.body?.profile || req.query?.profile;
  if (!profile || !security.hasUserProfile(req.user.id, profile) || !security.hasPermission({ ...REQUIRED_PERMISSION, profile })) {
    res.status(STATUS_CODES.FORBIDDEN).json({
      statusCode: STATUS_CODES.FORBIDDEN,
      message: config.getMessage('es', 'forbidden'),
    });
    return false;
  }
  return true;
};

// POST /tracker/attachments — sube un anexo del reporte del día (ej. PDF del Dashboard de Seguridad).
router.post('/attachments', (req, res) => {
  upload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) {
      const message =
        uploadErr.message === 'INVALID_MIME'
          ? 'Tipo de archivo no permitido (solo pdf, jpg, png o webp)'
          : uploadErr.message || 'Error al procesar el archivo';
      return res.status(STATUS_CODES.BAD_REQUEST).json({ statusCode: STATUS_CODES.BAD_REQUEST, message });
    }

    try {
      if (!requireAccess(req, res)) return;

      const { fecha, tipo } = req.body || {};
      if (!fecha || !SAFE_DATE.test(fecha) || !tipo) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          statusCode: STATUS_CODES.BAD_REQUEST,
          message: "Campos requeridos: 'fecha' (YYYY-MM-DD), 'tipo', 'profile'",
        });
      }
      if (!req.file) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          statusCode: STATUS_CODES.BAD_REQUEST,
          message: "Falta el archivo 'file'",
        });
      }

      const ext = MIME_EXT[req.file.mimetype];
      const dir = path.join(UPLOADS_ROOT, fecha);
      await fs.mkdir(dir, { recursive: true });
      const filename = `${tipo}-${randomUUID()}${ext}`;
      await fs.writeFile(path.join(dir, filename), req.file.buffer);
      const url = `/tracker/attachments/file/${fecha}/${filename}`;

      const dbms = await getDbms();
      const insertResult = await dbms.executeNamedQuery({
        nameQuery: 'insertTrackerAttachment',
        params: {
          fecha,
          tipo,
          filename: req.file.originalname || filename,
          url,
          mime_type: req.file.mimetype,
          size_bytes: req.file.size,
          uploaded_by: req.user.id,
        },
      });

      return res.status(STATUS_CODES.CREATED).json({
        statusCode: STATUS_CODES.CREATED,
        data: insertResult?.rows?.[0],
        message: 'Anexo subido exitosamente',
      });
    } catch (error) {
      console.error('Error subiendo anexo del Tracker:', error);
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        statusCode: STATUS_CODES.INTERNAL_SERVER_ERROR,
        message: config.getMessage('es', 'server_error'),
      });
    }
  });
});

// GET /tracker/attachments?fecha=YYYY-MM-DD&profile=admin — lista los anexos de una fecha.
router.get('/attachments', async (req, res) => {
  try {
    if (!requireAccess(req, res)) return;

    const { fecha } = req.query;
    if (!fecha || !SAFE_DATE.test(fecha)) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        statusCode: STATUS_CODES.BAD_REQUEST,
        message: "Parámetro requerido: 'fecha' (YYYY-MM-DD)",
      });
    }

    const dbms = await getDbms();
    const result = await dbms.executeNamedQuery({ nameQuery: 'getTrackerAttachmentsByFecha', params: { fecha } });
    return res.json({ statusCode: STATUS_CODES.OK, data: result?.rows || [] });
  } catch (error) {
    console.error('Error listando anexos del Tracker:', error);
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: STATUS_CODES.INTERNAL_SERVER_ERROR,
      message: config.getMessage('es', 'server_error'),
    });
  }
});

// DELETE /tracker/attachments/:id?profile=admin
router.delete('/attachments/:id', async (req, res) => {
  try {
    if (!requireAccess(req, res)) return;

    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ statusCode: STATUS_CODES.BAD_REQUEST, message: "'id' inválido" });
    }

    const dbms = await getDbms();
    const attachmentResult = await dbms.executeNamedQuery({ nameQuery: 'getTrackerAttachmentById', params: { id } });
    const attachment = attachmentResult?.rows?.[0];
    if (!attachment) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ statusCode: STATUS_CODES.NOT_FOUND, message: `Anexo con id ${id} no encontrado` });
    }

    await dbms.executeNamedQuery({ nameQuery: 'deleteTrackerAttachment', params: { id } });

    try {
      const relative = attachment.url.replace(/^\/tracker\/attachments\/file\//, '');
      const filePath = path.resolve(UPLOADS_ROOT, relative);
      if (filePath === UPLOADS_ROOT || filePath.startsWith(UPLOADS_ROOT + path.sep)) {
        await fs.unlink(filePath);
      }
    } catch (unlinkErr) {
      console.warn('No se pudo borrar el archivo del anexo:', unlinkErr.message);
    }

    return res.json({ statusCode: STATUS_CODES.OK, message: 'Anexo eliminado' });
  } catch (error) {
    console.error('Error eliminando anexo del Tracker:', error);
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: STATUS_CODES.INTERNAL_SERVER_ERROR,
      message: config.getMessage('es', 'server_error'),
    });
  }
});

// GET /tracker/attachments/file/:fecha/:filename — sirve el archivo (requiere sesión).
router.get('/attachments/file/:fecha/:filename', async (req, res) => {
  if (!req.user) {
    return res.status(STATUS_CODES.UNAUTHORIZED).json({
      statusCode: STATUS_CODES.UNAUTHORIZED,
      message: config.getMessage('es', 'session_required'),
    });
  }

  const { fecha, filename } = req.params;
  if (!SAFE_DATE.test(fecha) || !SAFE_SEGMENT.test(filename)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json({ statusCode: STATUS_CODES.BAD_REQUEST, message: 'Ruta de archivo inválida' });
  }

  const filePath = path.resolve(UPLOADS_ROOT, fecha, filename);
  if (filePath !== UPLOADS_ROOT && !filePath.startsWith(UPLOADS_ROOT + path.sep)) {
    return res.status(STATUS_CODES.FORBIDDEN).json({ statusCode: STATUS_CODES.FORBIDDEN, message: config.getMessage('es', 'forbidden') });
  }

  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(STATUS_CODES.NOT_FOUND).json({ statusCode: STATUS_CODES.NOT_FOUND, message: 'Archivo no encontrado' });
    }
  });
});

export default router;
