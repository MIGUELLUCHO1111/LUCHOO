import cron from 'node-cron';
import PlanPreventivo from '../bo/sub_system/classes/planPreventivo.js';

// Cron de Mantenimiento (063): cada mañana crea las OT preventivas de los
// servicios VENCIDOS que no tienen una OT abierta (§9.1: la preventiva se
// origina del plan). Solo si el ajuste MNT_AUTO_PREVENTIVA está en "on"
// (Mantenimiento > Criticidad y ajustes); se revisa en cada corrida, así se
// enciende o apaga sin reiniciar. Horario: MNT_PREVENTIVA_CRON (por defecto
// 6:00 am, hora de Caracas; "off" lo desactiva del todo).
// Igual que el scheduler del Tracker: solo corre en el proceso líder.

export function startMaintenanceScheduler() {
  // Solo lo llama el proceso líder (src/scheduler/leader.js).

  const expression = process.env.MNT_PREVENTIVA_CRON || '0 6 * * *';
  if (expression === 'off') {
    console.log('[Mantenimiento] Generación automática de preventivas desactivada (MNT_PREVENTIVA_CRON=off)');
    return;
  }
  if (!cron.validate(expression)) {
    console.error(`[Mantenimiento] MNT_PREVENTIVA_CRON inválido: "${expression}"`);
    return;
  }
  cron.schedule(expression, async () => {
    try {
      const n = await new PlanPreventivo().generarPreventivasVencidas();
      if (n > 0) console.log(`[Mantenimiento] ${n} OT preventiva(s) creada(s) del plan`);
    } catch (e) {
      console.error('[Mantenimiento] Error generando preventivas:', e?.message || e);
    }
  }, { timezone: 'America/Caracas' });
  console.log(`[Mantenimiento] Revisión diaria del plan preventivo programada (${expression}, America/Caracas; crea OT solo si el ajuste está encendido)`);
}
