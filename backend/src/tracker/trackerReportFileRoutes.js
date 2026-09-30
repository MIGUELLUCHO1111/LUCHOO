import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Config from '../../config/config.js';
import Security from '../security/security.js';
import Reporte from '../bo/sub_system/classes/reporte.js';
import { buildModeloInternoWorkbook, buildModeloInternoHtml, modeloInternoFileName } from './modeloInterno.js';
import { renderReportOutputs } from './reportRenderer.js';

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

// GET /tracker/modelo-interno?turno=MATUTINO&formato=xlsx|pdf&profile=admin
// Reporte de turno "como el modelo interno" (provisional, pedido de Lguerra
// 30/09/2026): mismo formato que el que se genera en el chat
// (src/tracker/modeloInterno.js), con los datos del momento (enVivo).
const security = new Security();
const TURNOS_OK = ['MATUTINO', 'VESPERTINO', 'NOCTURNO'];
router.get('/modelo-interno', async (req, res) => {
  const fail = (statusCode, message) => res.status(statusCode).json({ statusCode, message });
  if (!req.user) return fail(STATUS_CODES.UNAUTHORIZED, config.getMessage('es', 'session_required'));
  const turno = String(req.query.turno || '').toUpperCase();
  const formato = String(req.query.formato || 'xlsx').toLowerCase();
  const profile = String(req.query.profile || '');
  if (!TURNOS_OK.includes(turno)) return fail(STATUS_CODES.BAD_REQUEST, 'Turno inválido (MATUTINO, VESPERTINO o NOCTURNO)');
  if (!['xlsx', 'pdf'].includes(formato)) return fail(STATUS_CODES.BAD_REQUEST, 'Formato inválido (xlsx o pdf)');
  if (!security.hasUserProfile(req.user.id, profile) || !security.hasPermission({ sub_system: 'Tracker', class: 'Reporte', method: 'generarReporte', profile })) {
    return fail(STATUS_CODES.FORBIDDEN, config.getMessage('es', 'forbidden'));
  }
  try {
    const { data } = await new Reporte().generarReporte({ turno, enVivo: true });
    const now = new Date();
    const filename = modeloInternoFileName(data, formato, now);
    let buffer;
    if (formato === 'xlsx') {
      buffer = Buffer.from(await buildModeloInternoWorkbook(data).xlsx.writeBuffer());
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else {
      ({ pdfBuffer: buffer } = await renderReportOutputs(buildModeloInternoHtml(data, now), { width: 900 }));
      res.setHeader('Content-Type', 'application/pdf');
    }
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    return res.send(buffer);
  } catch (error) {
    console.error('[Tracker] Error generando el modelo interno:', error);
    return fail(STATUS_CODES.INTERNAL_SERVER_ERROR, 'No se pudo generar el reporte');
  }
});

export default router;
