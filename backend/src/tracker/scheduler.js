import cron from 'node-cron';
import Snapshot from '../bo/sub_system/classes/snapshot.js';
import Archivo from '../bo/sub_system/classes/archivo.js';
import Notificador from '../bo/sub_system/classes/notificador.js';
import Comportamiento from '../bo/sub_system/classes/comportamiento.js';
import TelegramSubscriberSync from './telegramSubscriberSync.js';
import { TURNOS } from '../bo/sub_system/classes/reporte.js';

/**
 * Arranca la sincronización automática del Tracker GPS (Fase 2), sus alertas
 * y el archivado diario de retención. Corren dentro del mismo proceso del
 * backend -- no requieren un servidor aparte ni un Task Scheduler externo
 * mientras el backend esté encendido.
 *
 * Tres interruptores independientes (pedido de gerencia, 10/09/2026: mientras
 * se resuelven dudas sobre el acceso a la API del proveedor, cada pieza se
 * puede prender o apagar por separado sin tocar código):
 *   - TRACKER_AUTO_SYNC=false desactiva la sincronización y, con ella, las
 *     alertas de fuera de horario/fuera de zona (se evalúan justo después de
 *     cada sincronización, ver Alerta.evaluateSnapshots).
 *   - TRACKER_AUTO_REPORTES_TURNO=true activa los 3 reportes de turno
 *     (Excel/PDF/imagen, guardados en el historial y enviados por Telegram)
 *     al cierre de cada turno -- 11/09/2026: gerencia pidió reactivar esto
 *     específicamente, quedando aparte del resto.
 *   - TRACKER_AUTO_REPORTS distinto de 'true' desactiva el archivado de
 *     retención, el recordatorio de anexo de seguridad y el análisis diario
 *     de comportamiento -- se generan con los botones manuales de la
 *     pantalla de Reportes.
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
    console.log('[Tracker] Sincronización automática y alertas de fuera de horario desactivadas (TRACKER_AUTO_SYNC=false)');
  } else {
    // TRACKER_SYNC_CRON admite varios horarios separados por ';' (pedido de
    // gerencia, 10/09/2026: en vez de sincronizar cada 10 minutos todo el
    // día, solo unas pocas veces alrededor del horario límite -- menos
    // llamadas automáticas a la API del proveedor, pero igual cubre la
    // ventana en que puede dispararse la alerta de fuera de horario).
    const syncExpressions = String(process.env.TRACKER_SYNC_CRON || '*/10 * * * *')
      .split(';')
      .map((expr) => expr.trim())
      .filter(Boolean);

    const snapshot = new Snapshot();
    const programados = [];
    for (const expr of syncExpressions) {
      if (!cron.validate(expr)) {
        console.error(`[Tracker] TRACKER_SYNC_CRON inválido: '${expr}' -- ese horario no se programó`);
        continue;
      }
      cron.schedule(expr, () => snapshot.runScheduledSync(), { timezone: 'America/Caracas' });
      programados.push(expr);
    }

    if (programados.length > 0) {
      console.log(`[Tracker] Sincronización y alertas de fuera de horario programadas (${programados.join(' | ')}, America/Caracas)`);
    } else {
      console.error('[Tracker] Ningún horario válido en TRACKER_SYNC_CRON -- sincronización automática no programada');
    }
  }

  // Reportes de turno por Telegram: guarda Excel/PDF/imagen en el historial
  // y manda el PDF al cerrar cada turno. Aparte del resto (ver encabezado) --
  // gerencia lo pidió reactivar puntualmente el 11/09/2026.
  if (process.env.TRACKER_AUTO_REPORTES_TURNO === 'true') {
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
  } else {
    console.log('[Tracker] Reportes de turno automáticos desactivados (TRACKER_AUTO_REPORTES_TURNO != true) -- usar "Generar ahora" en Reportes');
  }

  // Archivado de retención, recordatorio de anexo de seguridad y análisis
  // diario de comportamiento: desactivados por separado de lo de arriba (ver
  // encabezado) -- se generan a mano desde los botones de la pantalla de
  // Reportes hasta que TRACKER_AUTO_REPORTS=true.
  if (process.env.TRACKER_AUTO_REPORTS !== 'true') {
    console.log('[Tracker] Análisis diario y archivado automáticos desactivados (TRACKER_AUTO_REPORTS != true) -- usar los botones manuales de Reportes');
    return;
  }

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

  // Recordatorio de anexo de seguridad: si al final del día no se subió el
  // PDF del Dashboard de Seguridad.
  const notificadorAnexo = new Notificador();
  const anexoExpression = process.env.TRACKER_NOTIFY_ANEXO_CRON || '15 22 * * *';
  if (cron.validate(anexoExpression)) {
    cron.schedule(
      anexoExpression,
      async () => {
        try {
          const result = await notificadorAnexo.verificarAnexoSeguridad({});
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
