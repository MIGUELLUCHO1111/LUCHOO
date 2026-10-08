import pg from 'pg';
import { dbConfig } from '../../config/db.js';

// Elección de líder para las tareas programadas (08/10/2026, despliegue en
// Azure).
//
// El problema: los cron (sincronización y alertas del Tracker, avisos de
// cierre de turno, lectura de Telegram, preventivas de Mantenimiento, km del
// GPS de Flota) tienen que correr en UN solo proceso. Antes se garantizaba
// con NODE_APP_INSTANCE === '0', que solo sirve dentro de UN PM2: en Azure,
// con varias instancias (escalado horizontal), cada instancia tiene su propio
// proceso 0 y todo se duplicaría -- N avisos iguales por Telegram, N OT
// preventivas, y Telegram respondiendo 409 porque dos procesos leen el bot.
//
// La solución: un advisory lock de Postgres. Cada proceso intenta tomarlo con
// una conexión propia que mantiene abierta; el que lo consigue es el líder y
// arranca los cron. Los demás reintentan cada LEADER_RETRY_MS. Si el líder se
// cae (o se reinicia la instancia), Postgres libera el lock al cerrarse su
// conexión y otro proceso lo toma en el siguiente reintento.
//
// Si la conexión del líder se pierde, el lock ya no es suyo pero sus cron
// siguen programados -- para no terminar con dos líderes, el proceso se cierra
// y la plataforma (PM2 / Azure) lo vuelve a levantar limpio.
//
// SCHEDULER_ENABLED=false apaga todo en esa máquina: es lo que hay que poner
// en las computadoras de desarrollo una vez que Azure esté en producción
// (comparten el mismo bot de Telegram).

const LOCK_KEY = 727001; // número fijo y arbitrario, solo identifica "el scheduler de Fullpetro"
const RETRY_MS = Number.parseInt(process.env.LEADER_RETRY_MS, 10) || 60_000;
const HEALTH_MS = 30_000;

let lockClient = null;
let retryTimer = null;
let healthTimer = null;
let isLeader = false;

export const schedulerIsLeader = () => isLeader;

async function tryAcquire(onLeader) {
  let client;
  try {
    client = new pg.Client({ ...dbConfig, application_name: 'fullpetro-scheduler' });
    client.on('error', (err) => {
      if (!isLeader) return;
      console.error('[Scheduler] Se perdió la conexión que sostiene el liderazgo:', err?.message || err);
      process.exit(1);
    });
    await client.connect();
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY]);
    if (!rows[0]?.ok) {
      await client.end().catch(() => {});
      return false;
    }
  } catch (err) {
    console.error('[Scheduler] No se pudo intentar el liderazgo:', err?.message || err);
    if (client) await client.end().catch(() => {});
    return false;
  }

  lockClient = client;
  isLeader = true;
  clearInterval(retryTimer);
  console.log(`[Scheduler] Este proceso es el líder (pid ${process.pid}): arrancan las tareas programadas`);

  // Chequeo liviano: si la conexión murió sin emitir 'error', igual se nota.
  healthTimer = setInterval(() => {
    lockClient.query('SELECT 1').catch((err) => {
      console.error('[Scheduler] La conexión del líder dejó de responder:', err?.message || err);
      process.exit(1);
    });
  }, HEALTH_MS);
  healthTimer.unref();

  onLeader();
  return true;
}

/**
 * Corre onLeader() una sola vez, y solo en el proceso que gane el liderazgo
 * entre todas las instancias que comparten la misma base de datos.
 */
export async function runAsLeader(onLeader) {
  if (process.env.SCHEDULER_ENABLED === 'false') {
    console.log('[Scheduler] Tareas programadas desactivadas en esta máquina (SCHEDULER_ENABLED=false)');
    return;
  }
  if (await tryAcquire(onLeader)) return;
  console.log(`[Scheduler] Otro proceso ya es el líder; este reintenta cada ${Math.round(RETRY_MS / 1000)} s por si se cae`);
  retryTimer = setInterval(() => {
    tryAcquire(onLeader).catch(() => {});
  }, RETRY_MS);
  retryTimer.unref();
}

/** Suelta el lock al apagar ordenadamente, para que otro tome el relevo ya. */
export async function releaseLeadership() {
  clearInterval(retryTimer);
  clearInterval(healthTimer);
  if (!lockClient) return;
  isLeader = false;
  try {
    await lockClient.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
  } catch {
    // si falla, cerrar la conexión libera el lock igual
  }
  await lockClient.end().catch(() => {});
  lockClient = null;
}
