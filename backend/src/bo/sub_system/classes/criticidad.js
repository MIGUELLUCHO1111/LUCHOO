import { MntBase, STATUS_CODES, badRequest, forbidden, notFound, CRIT_LEVELS, isGerencia, text, amount } from './mntCommon.js';

// Criticidad por unidad (§5 de la política; base por categoría sembrada en
// 062_maintenance.sql, ajustable por unidad) y ajustes de Mantenimiento.
// Solo admin y gerencia (permission.csv).

const SETTING_KEYS = {
  CORRECTIVA_MAYOR_UMBRAL_USD: 'El umbral en USD',
  EMERGENCIA_REGULARIZAR_HORAS: 'Las horas para regularizar una emergencia',
  OT_ESTANCADA_DIAS: 'Los días para considerar una OT estancada',
  PROXIMO_PORCENTAJE: 'El porcentaje del intervalo para marcar un servicio como próximo',
  PROXIMO_DIAS: 'Los días para marcar un servicio como próximo',
  MNT_AUTO_PREVENTIVA: 'Generar OT preventivas automáticamente',
};

class Criticidad extends MntBase {
  listarCriticidad = async () => {
    const rows = await this.query('mntListCriticality');
    return { statusCode: STATUS_CODES.OK, data: rows };
  };

  guardarCriticidad = async ({ unit_id, level, note, caller_profile, caller_user }) => {
    if (!isGerencia(caller_profile)) throw forbidden('Solo la Gerencia o un administrador cambia la criticidad.');
    if (!unit_id) throw badRequest("Campo requerido: 'unit_id'");
    const nivel = String(level || '').toUpperCase();
    if (!CRIT_LEVELS.includes(nivel)) throw badRequest('Nivel de criticidad inválido.');
    const [unit] = await this.query('mntGetUnit', { id: Number(unit_id) });
    if (!unit) throw notFound('Unidad no encontrada.');
    const [row] = await this.query('mntUpsertCriticality', { unit_id: Number(unit_id), level: nivel, note: text(note, 1000) || null, updated_by: caller_user || null });
    const label = { CRITICO: 'Crítico', SEMICRITICO: 'Semi-crítico', NO_CRITICO: 'No crítico' }[nivel];
    await this.fleetEvent(unit_id, `Criticidad: ${label}`, note || null, caller_user);
    return { statusCode: STATUS_CODES.OK, data: row, message: 'Criticidad guardada' };
  };

  getAjustesMantenimiento = async () => {
    const rows = await this.query('mntGetSettings');
    return { statusCode: STATUS_CODES.OK, data: Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  };

  // Valor vacío en el umbral = sin definir (decide solo la criticidad).
  guardarAjustesMantenimiento = async ({ ajustes, caller_profile }) => {
    if (!isGerencia(caller_profile)) throw forbidden('Solo la Gerencia o un administrador cambia los ajustes.');
    const entries = Object.entries(ajustes || {}).filter(([k]) => SETTING_KEYS[k]);
    if (!entries.length) throw badRequest('No hay ajustes para guardar.');
    for (const [key, raw] of entries) {
      if (key === 'MNT_AUTO_PREVENTIVA') {
        await this.query('mntUpsertSetting', { key, value: raw === true || raw === 'on' ? 'on' : 'off' });
        continue;
      }
      const n = amount(raw, SETTING_KEYS[key]);
      if (key !== 'CORRECTIVA_MAYOR_UMBRAL_USD' && (n == null || n <= 0)) throw badRequest(`${SETTING_KEYS[key]} debe ser mayor a 0.`);
      await this.query('mntUpsertSetting', { key, value: n == null ? null : String(n) });
    }
    return this.getAjustesMantenimiento();
  };
}

export default Criticidad;
