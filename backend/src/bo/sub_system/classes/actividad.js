import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import { flushActivity } from '../../../security/activityTracker.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Seguridad > Actividad de usuarios (migración 066, 08/10/2026): última vez
// que entró cada usuario y una auditoría pequeña de uso. Solo lectura.
// Nombres de método únicos a propósito (ver CLAUDE.md: los permisos se
// expanden por nombre de método a todas las clases).

const ONLINE_MS = 5 * 60 * 1000;

const estadoDe = (lastSeen, now) => {
  if (!lastSeen) return { estado: 'NUNCA', etiqueta: 'Nunca ha entrado' };
  const ms = now - new Date(lastSeen).getTime();
  if (ms < ONLINE_MS) return { estado: 'EN_LINEA', etiqueta: 'En línea' };
  const fmt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(d);
  if (fmt(new Date(lastSeen)) === fmt(new Date(now))) return { estado: 'HOY', etiqueta: 'Activo hoy' };
  const dias = Math.max(1, Math.floor(ms / 86_400_000));
  return { estado: dias <= 7 ? 'RECIENTE' : 'INACTIVO', etiqueta: `Hace ${dias} día${dias === 1 ? '' : 's'}` };
};

class Actividad {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  listarActividadUsuarios = async () => {
    await this.dbmsReady;
    // Lo acumulado en memoria de ESTE proceso se guarda antes de leer, así
    // el admin ve su propia actividad al día (las otras instancias guardan
    // la suya cada minuto).
    await flushActivity().catch(() => {});

    const [usuarios, fallidos] = await Promise.all([
      this.dbms.executeNamedQuery({ nameQuery: 'auditUsersOverview', params: {} }),
      this.dbms.executeNamedQuery({ nameQuery: 'auditRecentFailures', params: {} }),
    ]);

    const now = Date.now();
    const data = (usuarios?.rows || []).map((u) => ({
      ...u,
      actions_today: Number(u.actions_today) || 0,
      writes_today: Number(u.writes_today) || 0,
      active_days_7: Number(u.active_days_7) || 0,
      actions_7: Number(u.actions_7) || 0,
      logins_7: Number(u.logins_7) || 0,
      ...estadoDe(u.last_seen_at, now),
    }));

    const resumen = {
      total: data.length,
      en_linea: data.filter((u) => u.estado === 'EN_LINEA').length,
      activos_hoy: data.filter((u) => u.estado === 'EN_LINEA' || u.estado === 'HOY').length,
      activos_7_dias: data.filter((u) => u.active_days_7 > 0).length,
      nunca: data.filter((u) => u.estado === 'NUNCA').length,
      intentos_fallidos_7_dias: fallidos?.rows?.length || 0,
    };

    return { statusCode: STATUS_CODES.OK, data: { resumen, usuarios: data, fallidos: fallidos?.rows || [] } };
  };

  obtenerActividadUsuario = async ({ user_id, days }) => {
    await this.dbmsReady;
    if (!user_id) {
      throw new Error(JSON.stringify({ message: "Campo requerido: 'user_id'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }
    const dias = Math.min(Math.max(Number.parseInt(days, 10) || 14, 1), 90);
    await flushActivity().catch(() => {});

    const [diario, eventos] = await Promise.all([
      this.dbms.executeNamedQuery({ nameQuery: 'auditUserDaily', params: { user_id, days: dias } }),
      this.dbms.executeNamedQuery({ nameQuery: 'auditUserEvents', params: { user_id } }),
    ]);

    return {
      statusCode: STATUS_CODES.OK,
      data: { dias, diario: diario?.rows || [], eventos: eventos?.rows || [] },
    };
  };
}

export { Actividad };
export default Actividad;
