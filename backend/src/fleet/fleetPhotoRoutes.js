import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import DBMS from '../dbms/dbms.js';
import Config from '../../config/config.js';
import Security from '../security/security.js';

// Foto de cada modelo del Catalogo de Flota. Ruta aparte del dispatcher
// JSON (igual que fuel/fuelPhotoRoutes.js): la subida necesita multipart.
// Solo queda la foto mas reciente de cada modelo; la anterior se borra.

const router = express.Router();
const config = new Config();
const security = new Security();
const { STATUS_CODES } = config;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads/fleet/models');
const MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (MIME_EXT[file.mimetype] ? cb(null, true) : cb(new Error('INVALID_MIME'))),
});

const fail = (res, statusCode, message) => res.status(statusCode).json({ statusCode, message });

// POST /fleet/models/photo — campos: model_id, profile, photo (archivo).
router.post('/models/photo', (req, res) => {
  upload.single('photo')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return fail(res, STATUS_CODES.BAD_REQUEST, uploadErr.message === 'INVALID_MIME' ? 'Tipo de archivo no permitido (solo jpg, png o webp)' : uploadErr.message || 'Error al procesar el archivo');
    }
    try {
      if (!req.user) return fail(res, STATUS_CODES.UNAUTHORIZED, config.getMessage('es', 'session_required'));
      const { model_id: modelId, profile } = req.body || {};
      const id = parseInt(modelId, 10);
      if (!Number.isInteger(id) || !profile) return fail(res, STATUS_CODES.BAD_REQUEST, "Campos requeridos: 'model_id' y 'profile'");
      if (!req.file) return fail(res, STATUS_CODES.BAD_REQUEST, "Falta el archivo 'photo'");
      if (!security.hasUserProfile(req.user.id, profile) || !security.hasPermission({ sub_system: 'Flota', class: 'Catalogo', method: 'guardarModelo', profile })) {
        return fail(res, STATUS_CODES.FORBIDDEN, config.getMessage('es', 'forbidden'));
      }

      const dbms = new DBMS();
      await dbms.init();
      const found = await dbms.executeNamedQuery({ nameQuery: 'fleetGetModel', params: { id } });
      const modelo = found?.rows?.[0];
      if (!modelo) return fail(res, STATUS_CODES.NOT_FOUND, `Modelo con id ${id} no encontrado`);

      const dir = path.join(UPLOADS_ROOT, String(id));
      await fs.mkdir(dir, { recursive: true });
      const filename = `${randomUUID()}${MIME_EXT[req.file.mimetype]}`;
      await fs.writeFile(path.join(dir, filename), req.file.buffer);
      const url = `/fleet/models/file/${id}/${filename}`;
      await dbms.executeNamedQuery({ nameQuery: 'fleetSetModelPhoto', params: { id, photo_url: url } });

      // Borrar la foto anterior de este modelo (si era de esta misma carpeta).
      const prev = modelo.photo_url && modelo.photo_url.split('/').pop();
      if (prev && SAFE_SEGMENT.test(prev) && prev !== filename) {
        await fs.unlink(path.join(dir, prev)).catch(() => {});
      }

      return res.status(STATUS_CODES.CREATED).json({ statusCode: STATUS_CODES.CREATED, data: { id, photo_url: url }, message: 'Foto guardada' });
    } catch (error) {
      console.error('[Flota] Error subiendo foto de modelo:', error);
      return fail(res, STATUS_CODES.INTERNAL_SERVER_ERROR, config.getMessage('es', 'server_error'));
    }
  });
});

// GET /fleet/models/file/:modelId/:filename — solo con sesion.
router.get('/models/file/:modelId/:filename', async (req, res) => {
  if (!req.user) return fail(res, STATUS_CODES.UNAUTHORIZED, config.getMessage('es', 'session_required'));
  const { modelId, filename } = req.params;
  if (!SAFE_SEGMENT.test(modelId) || !SAFE_SEGMENT.test(filename)) return fail(res, STATUS_CODES.BAD_REQUEST, 'Ruta de archivo inválida');
  const filePath = path.resolve(UPLOADS_ROOT, modelId, filename);
  if (!filePath.startsWith(UPLOADS_ROOT + path.sep)) return fail(res, STATUS_CODES.FORBIDDEN, config.getMessage('es', 'forbidden'));
  res.sendFile(filePath, { maxAge: '7d' }, (err) => {
    if (err && !res.headersSent) fail(res, STATUS_CODES.NOT_FOUND, 'Archivo no encontrado');
  });
});

// ---------- Archivo de cada documento de la ficha (PDF o foto) ----------
const DOCS_ROOT = path.resolve(__dirname, '../../uploads/fleet/documents');
const DOC_EXT = { ...MIME_EXT, 'application/pdf': '.pdf' };
const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (DOC_EXT[file.mimetype] ? cb(null, true) : cb(new Error('INVALID_MIME'))),
});

// POST /fleet/documents/file — campos: document_id, profile, file.
router.post('/documents/file', (req, res) => {
  uploadDoc.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return fail(res, STATUS_CODES.BAD_REQUEST, uploadErr.message === 'INVALID_MIME' ? 'Tipo de archivo no permitido (solo PDF, JPG, PNG o WEBP)' : uploadErr.code === 'LIMIT_FILE_SIZE' ? 'El archivo pesa más de 10 MB' : uploadErr.message || 'Error al procesar el archivo');
    }
    try {
      if (!req.user) return fail(res, STATUS_CODES.UNAUTHORIZED, config.getMessage('es', 'session_required'));
      const { document_id: documentId, profile } = req.body || {};
      const id = parseInt(documentId, 10);
      if (!Number.isInteger(id) || !profile) return fail(res, STATUS_CODES.BAD_REQUEST, "Campos requeridos: 'document_id' y 'profile'");
      if (!req.file) return fail(res, STATUS_CODES.BAD_REQUEST, "Falta el archivo 'file'");
      if (!security.hasUserProfile(req.user.id, profile) || !security.hasPermission({ sub_system: 'Flota', class: 'Ficha', method: 'guardarDocumento', profile })) {
        return fail(res, STATUS_CODES.FORBIDDEN, config.getMessage('es', 'forbidden'));
      }

      const dbms = new DBMS();
      await dbms.init();
      const found = await dbms.executeNamedQuery({ nameQuery: 'fleetGetDocument', params: { id } });
      const doc = found?.rows?.[0];
      if (!doc) return fail(res, STATUS_CODES.NOT_FOUND, `Documento con id ${id} no encontrado`);

      const dir = path.join(DOCS_ROOT, String(id));
      await fs.mkdir(dir, { recursive: true });
      const filename = `${randomUUID()}${DOC_EXT[req.file.mimetype]}`;
      await fs.writeFile(path.join(dir, filename), req.file.buffer);
      const url = `/fleet/documents/file/${id}/${filename}`;
      const originalName = String(req.file.originalname || filename).slice(0, 200);
      await dbms.executeNamedQuery({ nameQuery: 'fleetSetDocumentFile', params: { id, file_url: url, file_name: originalName, file_mime: req.file.mimetype } });

      const prev = doc.file_url && doc.file_url.split('/').pop();
      if (prev && SAFE_SEGMENT.test(prev) && prev !== filename) await fs.unlink(path.join(dir, prev)).catch(() => {});

      return res.status(STATUS_CODES.CREATED).json({ statusCode: STATUS_CODES.CREATED, data: { id, file_url: url }, message: 'Archivo guardado' });
    } catch (error) {
      console.error('[Flota] Error subiendo archivo de documento:', error);
      return fail(res, STATUS_CODES.INTERNAL_SERVER_ERROR, config.getMessage('es', 'server_error'));
    }
  });
});

// GET /fleet/documents/file/:docId/:filename — solo con sesion.
router.get('/documents/file/:docId/:filename', async (req, res) => {
  if (!req.user) return fail(res, STATUS_CODES.UNAUTHORIZED, config.getMessage('es', 'session_required'));
  const { docId, filename } = req.params;
  if (!SAFE_SEGMENT.test(docId) || !SAFE_SEGMENT.test(filename)) return fail(res, STATUS_CODES.BAD_REQUEST, 'Ruta de archivo inválida');
  const filePath = path.resolve(DOCS_ROOT, docId, filename);
  if (!filePath.startsWith(DOCS_ROOT + path.sep)) return fail(res, STATUS_CODES.FORBIDDEN, config.getMessage('es', 'forbidden'));
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) fail(res, STATUS_CODES.NOT_FOUND, 'Archivo no encontrado');
  });
});

export default router;
