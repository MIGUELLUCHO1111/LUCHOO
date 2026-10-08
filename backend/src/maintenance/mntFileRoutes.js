import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import DBMS from '../dbms/dbms.js';
import Config from '../../config/config.js';
import Security from '../security/security.js';
import { uploadsPath } from '../../config/paths.js';

// Evidencias de las Órdenes de Trabajo (§10.1 de la política: fotos y
// documentos en la hoja de vida). Ruta multipart aparte del dispatcher,
// igual que las fotos de Combustible y de Flota.
//   POST   /maintenance/files                 (campo "file", work_order_id, profile)
//   GET    /maintenance/files/file/:woId/:archivo?profile=
//   DELETE /maintenance/files/:id?profile=
// Permisos: subir y borrar = Mantenimiento.OrdenTrabajo.actualizarOrden y la
// OT abierta; ver = obtenerOrden.

const router = express.Router();
const config = new Config();
const security = new Security();
const { STATUS_CODES } = config;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = uploadsPath('maintenance');
const SAFE = /^[a-zA-Z0-9._-]+$/;
const TERMINAL = ['CERRADA', 'RECHAZADA', 'ANULADA'];

const TYPES = {
  'image/jpeg': { ext: '.jpg', ok: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: '.png', ok: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { ext: '.webp', ok: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  'application/pdf': { ext: '.pdf', ok: (b) => b.subarray(0, 4).toString() === '%PDF' },
};
const EXT_MIME = Object.fromEntries(Object.entries(TYPES).map(([m, t]) => [t.ext, m]));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (TYPES[file.mimetype] ? cb(null, true) : cb(new Error('INVALID_MIME'))),
});

const fail = (res, code, message) => res.status(code).json({ statusCode: code, message });

const can = (req, profile, method) =>
  req.user && profile && security.hasUserProfile(req.user.id, profile) &&
  security.hasPermission({ sub_system: 'Mantenimiento', class: 'OrdenTrabajo', method, profile });

let dbmsPromise;
const db = () => {
  if (!dbmsPromise) { const d = new DBMS(); dbmsPromise = d.init().then(() => d); }
  return dbmsPromise;
};
const q = async (nameQuery, params) => (await (await db()).executeNamedQuery({ nameQuery, params }))?.rows || [];

router.post('/files', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return fail(res, STATUS_CODES.BAD_REQUEST, err.message === 'INVALID_MIME' ? 'Solo se aceptan fotos (JPG, PNG, WEBP) o PDF.' : err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera los 10 MB.' : 'No se pudo leer el archivo.');
    try {
      if (!req.user) return fail(res, STATUS_CODES.UNAUTHORIZED, config.getMessage('es', 'session_required'));
      const { work_order_id: woRaw, profile } = req.body || {};
      if (!can(req, profile, 'actualizarOrden')) return fail(res, STATUS_CODES.FORBIDDEN, config.getMessage('es', 'forbidden'));
      const woId = Number.parseInt(woRaw, 10);
      if (!Number.isInteger(woId)) return fail(res, STATUS_CODES.BAD_REQUEST, "Falta 'work_order_id'.");
      if (!req.file) return fail(res, STATUS_CODES.BAD_REQUEST, "Falta el archivo 'file'.");
      const type = TYPES[req.file.mimetype];
      if (!type.ok(req.file.buffer)) return fail(res, STATUS_CODES.BAD_REQUEST, 'El contenido del archivo no corresponde a una foto o PDF válido.');
      const [wo] = await q('mntGetWorkOrder', { id: woId });
      if (!wo) return fail(res, STATUS_CODES.NOT_FOUND, 'Orden de trabajo no encontrada.');
      if (TERMINAL.includes(wo.status)) return fail(res, STATUS_CODES.CONFLICT || 409, `La OT ${wo.number} ya no se puede modificar.`);

      const name = `${randomUUID()}${type.ext}`;
      const dir = path.join(ROOT, String(woId));
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, name), req.file.buffer);
      const original = String(req.file.originalname || '').replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]/g, '_').slice(0, 200) || null;
      const who = req.user.username || req.user.name || null;
      const [row] = await q('mntInsertFile', { work_order_id: woId, url: `/maintenance/files/file/${woId}/${name}`, original_name: original, mime_type: req.file.mimetype, size_bytes: req.file.size, uploaded_by: who });
      await q('mntInsertEvent', { work_order_id: woId, title: 'Evidencia agregada', detail: original, created_by: who });
      return res.status(STATUS_CODES.CREATED || 201).json({ statusCode: STATUS_CODES.CREATED || 201, data: row, message: 'Evidencia agregada' });
    } catch (e) {
      console.error('[Mantenimiento] Error subiendo evidencia:', e);
      return fail(res, STATUS_CODES.INTERNAL_SERVER_ERROR || 500, config.getMessage('es', 'server_error'));
    }
  });
});

router.get('/files/file/:woId/:archivo', async (req, res) => {
  const { woId, archivo } = req.params;
  if (!req.user) return fail(res, STATUS_CODES.UNAUTHORIZED, config.getMessage('es', 'session_required'));
  if (!can(req, req.query.profile, 'obtenerOrden')) return fail(res, STATUS_CODES.FORBIDDEN, config.getMessage('es', 'forbidden'));
  if (!/^\d+$/.test(woId) || !SAFE.test(archivo)) return fail(res, STATUS_CODES.BAD_REQUEST, 'Ruta de archivo inválida');
  const filePath = path.resolve(ROOT, woId, archivo);
  if (!filePath.startsWith(ROOT + path.sep)) return fail(res, STATUS_CODES.FORBIDDEN, config.getMessage('es', 'forbidden'));
  const mime = EXT_MIME[path.extname(archivo).toLowerCase()];
  if (!mime) return fail(res, STATUS_CODES.BAD_REQUEST, 'Tipo de archivo no permitido');
  res.type(mime);
  if (mime === 'application/pdf') res.setHeader('Content-Disposition', `inline; filename="${archivo}"`);
  return res.sendFile(filePath, (err) => { if (err && !res.headersSent) fail(res, STATUS_CODES.NOT_FOUND, 'Archivo no encontrado'); });
});

router.delete('/files/:id', async (req, res) => {
  try {
    if (!req.user) return fail(res, STATUS_CODES.UNAUTHORIZED, config.getMessage('es', 'session_required'));
    if (!can(req, req.query.profile, 'actualizarOrden')) return fail(res, STATUS_CODES.FORBIDDEN, config.getMessage('es', 'forbidden'));
    const id = Number.parseInt(req.params.id, 10);
    const [file] = await q('mntGetFile', { id });
    if (!file) return fail(res, STATUS_CODES.NOT_FOUND, 'Evidencia no encontrada.');
    const [wo] = await q('mntGetWorkOrder', { id: Number(file.work_order_id) });
    if (wo && TERMINAL.includes(wo.status)) return fail(res, STATUS_CODES.CONFLICT || 409, `La OT ${wo.number} ya no se puede modificar.`);
    await q('mntDeleteFile', { id });
    const m = String(file.url).match(/^\/maintenance\/files\/file\/(\d+)\/([a-zA-Z0-9._-]+)$/);
    if (m) await fs.unlink(path.join(ROOT, m[1], m[2])).catch(() => {});
    await q('mntInsertEvent', { work_order_id: Number(file.work_order_id), title: 'Evidencia eliminada', detail: null, created_by: req.user.username || req.user.name || null });
    return res.json({ statusCode: STATUS_CODES.OK, message: 'Evidencia eliminada' });
  } catch (e) {
    console.error('[Mantenimiento] Error eliminando evidencia:', e);
    return fail(res, STATUS_CODES.INTERNAL_SERVER_ERROR || 500, config.getMessage('es', 'server_error'));
  }
});

export default router;
