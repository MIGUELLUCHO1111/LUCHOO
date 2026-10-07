import express from 'express';
import Config from '../../config/config.js';
import Security from '../security/security.js';
import Ficha from '../bo/sub_system/classes/ficha.js';
import Conductor from '../bo/sub_system/classes/conductor.js';
import { renderA4Pdf } from '../tracker/reportRenderer.js';
import { buildUnitSheetHtml, buildDriverSheetHtml, sheetFileName } from './fleetSheetPdf.js';

// Ficha imprimible en PDF (07/10/2026):
//   GET /fleet/units/:id/sheet.pdf?profile=     (permiso Flota.Ficha.obtener)
//   GET /fleet/drivers/:id/sheet.pdf?profile=   (permiso Flota.Conductor.obtenerConductor)
// Mismos datos que la pantalla; quien puede ver la ficha puede descargarla.

const router = express.Router();
const config = new Config();
const security = new Security();
const { STATUS_CODES } = config;
const fail = (res, statusCode, message) => res.status(statusCode).json({ statusCode, message });

const enviar = (res, buffer, filename) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  return res.send(buffer);
};

const handler = (method, build) => async (req, res) => {
  if (!req.user) return fail(res, STATUS_CODES.UNAUTHORIZED, config.getMessage('es', 'session_required'));
  const id = parseInt(req.params.id, 10);
  const profile = String(req.query.profile || '');
  if (!Number.isInteger(id) || !profile) return fail(res, STATUS_CODES.BAD_REQUEST, "Faltan 'id' o 'profile'");
  if (!security.hasUserProfile(req.user.id, profile) || !security.hasPermission({ sub_system: 'Flota', ...method, profile })) {
    return fail(res, STATUS_CODES.FORBIDDEN, config.getMessage('es', 'forbidden'));
  }
  try {
    const { html, filename } = await build({ id, profile, user: req.user });
    return enviar(res, await renderA4Pdf(html), filename);
  } catch (error) {
    let parsed = null;
    try { parsed = JSON.parse(error.message); } catch { /* error comun */ }
    if (parsed?.statusCode && parsed.statusCode < 500) return fail(res, parsed.statusCode, parsed.message);
    console.error('[Flota] Error generando la ficha en PDF:', error);
    return fail(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'No se pudo generar la ficha en PDF');
  }
};

const quien = (user) => user?.username || user?.name || null;

router.get('/units/:id/sheet.pdf', handler({ class: 'Ficha', method: 'obtener' }, async ({ id, profile, user }) => {
  const { data } = await new Ficha().obtener({ id, caller_profile: profile, caller_user_id: user.id });
  return { html: await buildUnitSheetHtml(data, { generadoPor: quien(user) }), filename: sheetFileName('Ficha', data.code) };
}));

router.get('/drivers/:id/sheet.pdf', handler({ class: 'Conductor', method: 'obtenerConductor' }, async ({ id, user }) => {
  const { data } = await new Conductor().obtenerConductor({ id });
  return { html: await buildDriverSheetHtml(data, { generadoPor: quien(user) }), filename: sheetFileName('Ficha_conductor', data.full_name) };
}));

export default router;
