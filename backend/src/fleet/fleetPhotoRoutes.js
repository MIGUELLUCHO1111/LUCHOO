import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import DBMS from '../dbms/dbms.js';
import Config from '../../config/config.js';
import Security from '../security/security.js';
import { canEditUnit } from '../bo/sub_system/classes/fleetAccess.js';

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
      if (!security.hasUserProfile(req.user.id, profile)) return fail(res, STATUS_CODES.FORBIDDEN, config.getMessage('es', 'forbidden'));

      const dbms = new DBMS();
      await dbms.init();
      const found = await dbms.executeNamedQuery({ nameQuery: 'fleetGetModel', params: { id } });
      const modelo = found?.rows?.[0];
      if (!modelo) return fail(res, STATUS_CODES.NOT_FOUND, `Modelo con id ${id} no encontrado`);
      // Admin: cualquier modelo. Encargado: solo SU propuesta mientras esta pendiente.
      const esAdmin = security.hasPermission({ sub_system: 'Flota', class: 'Catalogo', method: 'guardarModelo', profile });
      const esSuPropuesta = modelo.status === 'PENDIENTE' && Number(modelo.proposed_by_user_id) === Number(req.user.id)
        && security.hasPermission({ sub_system: 'Flota', class: 'Catalogo', method: 'proponerModelo', profile });
      if (!esAdmin && !esSuPropuesta) return fail(res, STATUS_CODES.FORBIDDEN, config.getMessage('es', 'forbidden'));

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
      // Un encargado solo adjunta archivos a documentos de SUS unidades.
      if (!(await canEditUnit(dbms, { caller_profile: profile, caller_user_id: req.user.id, unit_id: doc.unit_id }))) {
        return fail(res, STATUS_CODES.FORBIDDEN, 'Solo puedes modificar las unidades que tienes asignadas como encargado.');
      }

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

// ---------- Foto propia de cada unidad (053_fleet_unit_photo.sql) ----------
// Pedido de Lguerra (05/10/2026): cada ficha con su foto, cargada desde el
// encabezado. Solo queda la mas reciente; la anterior se borra. La sube un
// admin o el encargado de esa unidad (mismo criterio que los documentos).
const UNITS_ROOT = path.resolve(__dirname, '../../uploads/fleet/units');

const callerName = (req) => req.user?.username || req.user?.name || null;

// Verifica sesion, perfil, permiso de editar fichas y acceso a ESA unidad.
const checkUnitPhotoAccess = async (req, res, unitIdRaw, profile) => {
  if (!req.user) { fail(res, STATUS_CODES.UNAUTHORIZED, config.getMessage('es', 'session_required')); return null; }
  const unitId = parseInt(unitIdRaw, 10);
  if (!Number.isInteger(unitId) || !profile) { fail(res, STATUS_CODES.BAD_REQUEST, "Campos requeridos: 'unit_id' y 'profile'"); return null; }
  if (!security.hasUserProfile(req.user.id, profile) || !security.hasPermission({ sub_system: 'Flota', class: 'Ficha', method: 'guardar', profile })) {
    fail(res, STATUS_CODES.FORBIDDEN, config.getMessage('es', 'forbidden')); return null;
  }
  const dbms = new DBMS();
  await dbms.init();
  const found = await dbms.executeNamedQuery({ nameQuery: 'fleetGetUnitPhoto', params: { unit_id: unitId } });
  const unit = found?.rows?.[0];
  if (!unit) { fail(res, STATUS_CODES.NOT_FOUND, `Unidad con id ${unitId} no encontrada`); return null; }
  if (!(await canEditUnit(dbms, { caller_profile: profile, caller_user_id: req.user.id, unit_id: unitId }))) {
    fail(res, STATUS_CODES.FORBIDDEN, 'Solo puedes modificar las unidades que tienes asignadas como encargado.'); return null;
  }
  return { dbms, unitId, prevUrl: unit.photo_url };
};

const removeOldPhoto = async (unitId, prevUrl, keep) => {
  const prev = prevUrl && prevUrl.split('/').pop();
  if (prev && SAFE_SEGMENT.test(prev) && prev !== keep) await fs.unlink(path.join(UNITS_ROOT, String(unitId), prev)).catch(() => {});
};

// POST /fleet/units/photo — campos: unit_id, profile, photo (archivo).
router.post('/units/photo', (req, res) => {
  upload.single('photo')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return fail(res, STATUS_CODES.BAD_REQUEST, uploadErr.message === 'INVALID_MIME' ? 'Tipo de archivo no permitido (solo jpg, png o webp)' : uploadErr.code === 'LIMIT_FILE_SIZE' ? 'La foto pesa más de 8 MB' : uploadErr.message || 'Error al procesar el archivo');
    }
    try {
      const ctx = await checkUnitPhotoAccess(req, res, req.body?.unit_id, req.body?.profile);
      if (!ctx) return undefined;
      if (!req.file) return fail(res, STATUS_CODES.BAD_REQUEST, "Falta el archivo 'photo'");
      const dir = path.join(UNITS_ROOT, String(ctx.unitId));
      await fs.mkdir(dir, { recursive: true });
      const filename = `${randomUUID()}${MIME_EXT[req.file.mimetype]}`;
      await fs.writeFile(path.join(dir, filename), req.file.buffer);
      const url = `/fleet/units/file/${ctx.unitId}/${filename}`;
      await ctx.dbms.executeNamedQuery({ nameQuery: 'fleetSetUnitPhoto', params: { unit_id: ctx.unitId, photo_url: url } });
      await ctx.dbms.executeNamedQuery({ nameQuery: 'fleetInsertEvent', params: { unit_id: ctx.unitId, event_type: 'EDICION', title: ctx.prevUrl ? 'Foto del vehículo cambiada' : 'Foto del vehículo cargada', detail: null, created_by: callerName(req) } });
      await removeOldPhoto(ctx.unitId, ctx.prevUrl, filename);
      return res.status(STATUS_CODES.CREATED).json({ statusCode: STATUS_CODES.CREATED, data: { unit_id: ctx.unitId, photo_url: url }, message: 'Foto guardada' });
    } catch (error) {
      console.error('[Flota] Error subiendo foto de unidad:', error);
      return fail(res, STATUS_CODES.INTERNAL_SERVER_ERROR, config.getMessage('es', 'server_error'));
    }
  });
});

// DELETE /fleet/units/photo?unit_id=&profile= — quita la foto propia.
router.delete('/units/photo', async (req, res) => {
  try {
    const ctx = await checkUnitPhotoAccess(req, res, req.query?.unit_id, req.query?.profile);
    if (!ctx) return undefined;
    if (!ctx.prevUrl) return res.json({ statusCode: STATUS_CODES.OK, data: { unit_id: ctx.unitId, photo_url: null }, message: 'La unidad no tenía foto' });
    await ctx.dbms.executeNamedQuery({ nameQuery: 'fleetSetUnitPhoto', params: { unit_id: ctx.unitId, photo_url: null } });
    await ctx.dbms.executeNamedQuery({ nameQuery: 'fleetInsertEvent', params: { unit_id: ctx.unitId, event_type: 'EDICION', title: 'Foto del vehículo quitada', detail: null, created_by: callerName(req) } });
    await removeOldPhoto(ctx.unitId, ctx.prevUrl, null);
    return res.json({ statusCode: STATUS_CODES.OK, data: { unit_id: ctx.unitId, photo_url: null }, message: 'Foto quitada' });
  } catch (error) {
    console.error('[Flota] Error quitando foto de unidad:', error);
    return fail(res, STATUS_CODES.INTERNAL_SERVER_ERROR, config.getMessage('es', 'server_error'));
  }
});

// GET /fleet/units/file/:unitId/:filename — solo con sesion.
router.get('/units/file/:unitId/:filename', async (req, res) => {
  if (!req.user) return fail(res, STATUS_CODES.UNAUTHORIZED, config.getMessage('es', 'session_required'));
  const { unitId, filename } = req.params;
  if (!SAFE_SEGMENT.test(unitId) || !SAFE_SEGMENT.test(filename)) return fail(res, STATUS_CODES.BAD_REQUEST, 'Ruta de archivo inválida');
  const filePath = path.resolve(UNITS_ROOT, unitId, filename);
  if (!filePath.startsWith(UNITS_ROOT + path.sep)) return fail(res, STATUS_CODES.FORBIDDEN, config.getMessage('es', 'forbidden'));
  return res.sendFile(filePath, { maxAge: '7d' }, (err) => {
    if (err && !res.headersSent) fail(res, STATUS_CODES.NOT_FOUND, 'Archivo no encontrado');
  });
});

export default router;
