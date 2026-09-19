import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Config from '../../config/config.js';

// Ruta aparte del dispatcher JSON (mismo espíritu que trackerAttachmentRoutes.js):
// descarga del Excel de un Reporte de Turno ya generado y guardado por
// fecha+turno (ver ReporteArchivo.generarYGuardar), para que quede a un
// clic desde el historial en vez de tener que reconstruirlo cada vez.

const router = express.Router();
const config = new Config();
const { STATUS_CODES } = config;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_ROOT = path.resolve(__dirname, '../../uploads/tracker/reports');

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;
const SAFE_DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /tracker/reports/file/:fecha/:filename — descarga (requiere sesión).
router.get('/reports/file/:fecha/:filename', async (req, res) => {
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

  const filePath = path.resolve(REPORTS_ROOT, fecha, filename);
  if (filePath !== REPORTS_ROOT && !filePath.startsWith(REPORTS_ROOT + path.sep)) {
    return res.status(STATUS_CODES.FORBIDDEN).json({ statusCode: STATUS_CODES.FORBIDDEN, message: config.getMessage('es', 'forbidden') });
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      res.status(STATUS_CODES.NOT_FOUND).json({ statusCode: STATUS_CODES.NOT_FOUND, message: 'Archivo no encontrado' });
    }
  });
});

export default router;
