import cron from 'node-cron';
import pool from '../../config/db.js';

// Registro de actividad de usuarios (Seguridad > Actividad de usuarios,
// migración 066, 08/10/2026).
//
// Para no escribir en la base en cada clic, la actividad se acumula en
// memoria y se guarda por lotes una vez por minuto (flushActivity). Con
// varias instancias cada una guarda lo suyo y la base lo suma (los UPSERT
// suman acciones y toman la última hora vista). Los eventos de sesión
// (login, logout) son pocos y se guardan al momento.

const TZ = 'America/Caracas';
const FLUSH_MS = 60_000;
const RETENTION_DAYS = Number.parseInt(process.env.USER_AUDIT_RETENTION_DAYS, 10) || 180;

// userId -> { at: Date, ip }
const seen = new Map();
// `${userId}|${fecha}` -> { userId, fecha, first, last, actions, writes, modules:Set }
const daily = new Map();

const fechaCaracas = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

const dayBucket = (userId, now) => {
  const fecha = fechaCaracas(now);
  const key = `${userId}|${fecha}`;
  let b = daily.get(key);
  if (!b) {
    b = { userId, fecha, first: now, last: now, actions: 0, writes: 0, modules: new Set() };
    daily.set(key, b);
  }
  b.last = now;
  return b;
};

/** Cualquier petición con sesión: el usuario está usando el sistema. */
export function touchUser(userId, ip) {
  const id = Number(userId);
  if (!Number.isFinite(id)) return;
  const now = new Date();
  seen.set(id, { at: now, ip: ip || seen.get(id)?.ip || null });
  dayBucket(id, now);
}

/** Una acción del despachador (consulta o escritura) en un módulo. */
export function recordAction(userId, module, isWrite) {
  const id = Number(userId);
  if (!Number.isFinite(id)) return;
  const b = dayBucket(id, new Date());
  b.actions += 1;
  if (isWrite) b.writes += 1;
  if (module) b.modules.add(String(module));
}

/**
 * Eventos de sesión, al momento: LOGIN_OK, LOGIN_FAIL, LOGIN_BLOCKED,
 * LOGOUT, LOGOUT_IDLE. Nunca debe romper el login: los errores solo se
 * anotan en el log.
 */
export async function recordSessionEvent({ userId = null, username = null, event, ip = null, userAgent = null }) {
  try {
    await pool.query(
      'INSERT INTO public.user_session_event (user_id, username, event, ip, user_agent) VALUES ($1, $2, $3, $4, $5)',
      [userId, username ? String(username).slice(0, 150) : null, event, ip, userAgent ? String(userAgent).slice(0, 300) : null],
    );
    if (event === 'LOGIN_OK' && userId) {
      await pool.query(
        'UPDATE public."user" SET last_login_at = NOW(), last_seen_at = NOW(), last_ip = $2 WHERE id = $1',
        [userId, ip],
      );
    }
  } catch (err) {
    console.error('[Actividad] No se pudo registrar el evento de sesión:', err?.message || err);
  }
}

/** Guarda lo acumulado. Se llama cada minuto y al apagar el proceso. */
export async function flushActivity() {
  if (!seen.size && !daily.size) return;
  const seenNow = [...seen.entries()];
  const dailyNow = [...daily.values()];
  seen.clear();
  daily.clear();
  try {
    for (const [userId, { at, ip }] of seenNow) {
      await pool.query(
        'UPDATE public."user" SET last_seen_at = GREATEST(COALESCE(last_seen_at, $2), $2), last_ip = COALESCE($3, last_ip) WHERE id = $1',
        [userId, at, ip],
      );
    }
    for (const b of dailyNow) {
      await pool.query(
        `INSERT INTO public.user_activity_daily (user_id, fecha, first_seen, last_seen, actions, writes, modules)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, fecha) DO UPDATE SET
           first_seen = LEAST(user_activity_daily.first_seen, EXCLUDED.first_seen),
           last_seen = GREATEST(user_activity_daily.last_seen, EXCLUDED.last_seen),
           actions = user_activity_daily.actions + EXCLUDED.actions,
           writes = user_activity_daily.writes + EXCLUDED.writes,
           modules = ARRAY(SELECT DISTINCT m FROM unnest(user_activity_daily.modules || EXCLUDED.modules) AS m ORDER BY m)`,
        [b.userId, b.fecha, b.first, b.last, b.actions, b.writes, [...b.modules]],
      );
    }
  } catch (err) {
    // Un usuario borrado de verdad (FK) o la base caída: se pierde ese lote
    // de estadística, nunca la petición del usuario.
    console.error('[Actividad] No se pudo guardar la actividad:', err?.message || err);
  }
}

const flushTimer = setInterval(() => {
  flushActivity().catch(() => {});
}, FLUSH_MS);
flushTimer.unref();

/** Limpieza diaria de lo viejo. Solo la programa el proceso líder. */
export function startAuditCleanup() {
  cron.schedule(
    '15 4 * * *',
    async () => {
      try {
        const ev = await pool.query(`DELETE FROM public.user_session_event WHERE created_at < NOW() - make_interval(days => $1)`, [RETENTION_DAYS]);
        const dy = await pool.query(`DELETE FROM public.user_activity_daily WHERE fecha < CURRENT_DATE - $1::int`, [RETENTION_DAYS]);
        if (ev.rowCount || dy.rowCount) {
          console.log(`[Actividad] Limpieza: ${ev.rowCount} evento(s) y ${dy.rowCount} día(s) de más de ${RETENTION_DAYS} días`);
        }
      } catch (err) {
        console.error('[Actividad] Error en la limpieza:', err?.message || err);
      }
    },
    { timezone: TZ },
  );
}
