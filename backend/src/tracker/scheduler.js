import cron from 'node-cron';
import Snapshot from '../bo/sub_system/classes/snapshot.js';
import Archivo from '../bo/sub_system/classes/archivo.js';
import Notificador from '../bo/sub_system/classes/notificador.js';
import Comportamiento from '../bo/sub_system/classes/comportamiento.js';
import TelegramSubscriberSync from './telegramSubscriberSync.js';
import { TURNOS } from '../bo/sub_system/classes/reporte.js';

/**
 * Arranca la sincronización automática del Tracker GPS (Fase 2) y el
 * archivado diario de retención. Corren dentro del mismo proceso del
 * backend -- no requieren un servidor aparte ni un Task Scheduler externo
 * mientras el backend esté encendido.
 *
 * TRACKER_AUTO_SYNC=false desactiva ambos cron sin tocar código (útil en
 * entornos de desarrollo donde no se quiere golpear la API real).
 *
 * IMPORTANTE para producción con PM2 en modo clúster (varios procesos del
 * mismo backend, ver DEPLOYMENT.md): PM2 numera cada proceso con
 * NODE_APP_INSTANCE (0, 1, 2...). Sin este chequeo, cada proceso programaría
 * los mismos cron por separado -- sincronizaría la flota N veces, mandaría
 * el mismo aviso de Telegram N veces, etc. Solo el proceso 0 los programa;
 * en modo single-process (como en desarrollo) NODE_APP_INSTANCE no existe,
 * así que igual corre normal.
 */
export function startTrackerScheduler() {
  const instanceId = process.env.NODE_APP_INSTANCE;
  if (instanceId !== undefined && instanceId !== '0') {
    console.log(`[Tracker] Cron del Tracker omitido en esta instancia (NODE_APP_INSTANCE=${instanceId}, solo corre en la 0)`);
    return;
  }

  // Suscriptores del bot de Telegram: independiente de TRACKER_AUTO_SYNC
  // (es sobre gente escribiéndole al bot, no sobre la flota) -- revisa cada
  // minuto para que alguien nuevo quede activo casi al instante.
  if (process.env.TELEGRAM_BOT_TOKEN) {
    const subscriberSync = new TelegramSubscriberSync();
    cron.schedule('* * * * *', async () => {
      try {
        const result = await subscriberSync.pollForNewSubscribers();
        if (result.nuevos > 0) {
          console.log(`[Tracker] ${result.nuevos} mensaje(s) nuevo(s) de Telegram procesado(s) (suscriptores)`);
        }
      } catch (error) {
        console.error('[Tracker] Error revisando suscriptores de Telegram:', error?.message || error);
      }
    });
    console.log('[Tracker] Registro automático de suscriptores de Telegram programado (cada minuto)');
  }

  if (process.env.TRACKER_AUTO_SYNC === 'false') {
    console.log('[Tracker] Sincronización automática desactivada (TRACKER_AUTO_SYNC=false)');
    return;
  }

  const syncExpression = process.env.TRACKER_SYNC_CRON || '*/10 * * * *';
  if (!cron.validate(syncExpression)) {
    console.error(`[Tracker] TRACKER_SYNC_CRON inválido: '${syncExpression}' -- cron no iniciado`);
    return;
  }

  const snapshot = new Snapshot();
  cron.schedule(syncExpression, () => snapshot.runScheduledSync());
  console.log(`[Tracker] Sincronización automática programada (${syncExpression})`);

  // Retención: resume a tracker_snapshot_summary y borra el detalle crudo
  // más viejo que TRACKER_RETENTION_MONTHS. Corre una vez al día de
  // madrugada (hora de Venezuela) -- el volumen diario es chico, así que no
  // hace falta más frecuencia.
  const archiveExpression = process.env.TRACKER_ARCHIVE_CRON || '0 3 * * *';
  if (!cron.validate(archiveExpression)) {
    console.error(`[Tracker] TRACKER_ARCHIVE_CRON inválido: '${archiveExpression}' -- archivado no programado`);
    return;
  }

  const archivo = new Archivo();
  cron.schedule(
    archiveExpression,
    async () => {
      try {
        const result = await archivo.archivarAhora();
        console.log(`[Tracker] Archivado automático: ${result.message}`);
      } catch (error) {
        console.error('[Tracker] Error en archivado automático:', error?.message || error);
      }
    },
    { timezone: 'America/Caracas' },
  );
  console.log(`[Tracker] Archivado de retención programado (${archiveExpression}, America/Caracas)`);

  // Avisos por Telegram: cierra el círculo de "hay que entrar a la app a
  // revisar" -- un mensaje al cierre de cada turno, y un recordatorio si al
  // final del día no se subió el PDF del Dashboard de Seguridad.
  const notificador = new Notificador();

  const NOTIFY_CRON_DEFAULTS = {
    MATUTINO: '5 9 * * *', // 9:05am
    VESPERTINO: '5 14 * * *', // 2:05pm
    NOCTURNO: '5 21 * * *', // 9:05pm
  };

  for (const turno of Object.keys(TURNOS)) {
    const envKey = `TRACKER_NOTIFY_${turno}_CRON`;
    const expression = process.env[envKey] || NOTIFY_CRON_DEFAULTS[turno];
    if (!cron.validate(expression)) {
      console.error(`[Tracker] ${envKey} inválido: '${expression}' -- aviso de ${turno} no programado`);
      continue;
    }
    cron.schedule(
      expression,
      async () => {
        try {
          const result = await notificador.notificarCierreDeTurno({ turno });
          console.log(`[Tracker] Aviso de cierre ${turno}: ${result.message}`);
        } catch (error) {
          console.error(`[Tracker] Error en aviso de cierre ${turno}:`, error?.message || error);
        }
      },
      { timezone: 'America/Caracas' },
    );
    console.log(`[Tracker] Aviso de cierre de turno ${turno} programado (${expression}, America/Caracas)`);
  }

  const anexoExpression = process.env.TRACKER_NOTIFY_ANEXO_CRON || '15 22 * * *';
  if (cron.validate(anexoExpression)) {
    cron.schedule(
      anexoExpression,
      async () => {
        try {
          const result = await notificador.verificarAnexoSeguridad({});
          console.log(`[Tracker] Verificación de anexo de seguridad: ${result.message}`);
        } catch (error) {
          console.error('[Tracker] Error verificando anexo de seguridad:', error?.message || error);
        }
      },
      { timezone: 'America/Caracas' },
    );
    console.log(`[Tracker] Recordatorio de anexo de seguridad programado (${anexoExpression}, America/Caracas)`);
  } else {
    console.error(`[Tracker] TRACKER_NOTIFY_ANEXO_CRON inválido: '${anexoExpression}' -- recordatorio no programado`);
  }

  // Análisis Operativo y Comportamiento de Conductores: antes solo se podía
  // generar a mano desde la pantalla de Reportes (tarda 1-2 min por el
  // límite de peticiones del proveedor). Se corre solo una vez, ya terminado
  // el turno Nocturno, y queda guardado (ver Comportamiento.getAnalisisDelDia)
  // para que la pantalla lo muestre sin que nadie tenga que pedirlo.
  const comportamiento = new Comportamiento();
  const analisisExpression = process.env.TRACKER_ANALISIS_CRON || '30 23 * * *';
  if (cron.validate(analisisExpression)) {
    cron.schedule(
      analisisExpression,
      async () => {
        try {
          const result = await comportamiento.getAnalisisDelDia({});
          console.log(
            `[Tracker] Análisis del día generado automáticamente: ${result.data.unidades_consultadas} unidad(es), ${result.data.total_viajes} viaje(s), ${result.data.errores.length} error(es)`,
          );
        } catch (error) {
          console.error('[Tracker] Error generando el análisis del día automáticamente:', error?.message || error);
        }
      },
      { timezone: 'America/Caracas' },
    );
    console.log(`[Tracker] Análisis diario de comportamiento programado (${analisisExpression}, America/Caracas)`);
  } else {
    console.error(`[Tracker] TRACKER_ANALISIS_CRON inválido: '${analisisExpression}' -- análisis diario no programado`);
  }
}
