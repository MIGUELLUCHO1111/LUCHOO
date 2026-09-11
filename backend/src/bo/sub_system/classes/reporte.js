import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Mismas 3 ventanas de corte que ya usaba el Excel manual (hoja "Listas",
// fórmula de "TURNO ACTUAL"): matutino, vespertino y nocturno, cada una de
// una hora. Fuera de estas ventanas no hay "reporte de turno" formal.
export const TURNOS = {
  MATUTINO: { startHour: 9, endHour: 10, label: 'Matutino (9:00 a.m. - 10:00 a.m.)' },
  VESPERTINO: { startHour: 14, endHour: 15, label: 'Vespertino (2:00 p.m. - 3:00 p.m.)' },
  NOCTURNO: { startHour: 21, endHour: 22, label: 'Nocturno (9:00 p.m. - 10:00 p.m.)' },
};

const veDateISO = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

const veHour = (date = new Date()) => {
  const hourStr = date.toLocaleString('en-US', { timeZone: 'America/Caracas', hour: '2-digit', hour12: false });
  return parseInt(hourStr, 10) % 24;
};

// Venezuela no usa horario de verano (UTC-4 fijo), así que la ventana de
// cada turno se puede construir como fecha+hora local con offset fijo.
const buildWindow = (fecha, turnoDef) => {
  const pad = (n) => String(n).padStart(2, '0');
  return {
    start: new Date(`${fecha}T${pad(turnoDef.startHour)}:00:00-04:00`),
    end: new Date(`${fecha}T${pad(turnoDef.endHour)}:00:00-04:00`),
  };
};

export function detectTurnoActual(date = new Date()) {
  const h = veHour(date);
  if (h >= 9 && h <= 10) return 'MATUTINO';
  if (h >= 14 && h <= 15) return 'VESPERTINO';
  if (h >= 21 && h <= 22) return 'NOCTURNO';
  return null;
}

class Reporte {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  // Reporte de turno (igual formato que el Excel manual): toma la última
  // lectura de cada unidad DENTRO de la ventana del turno solicitado (o el
  // turno actual si no se especifica), no la más reciente en general -- así
  // el reporte automático de las 9am no cambia si se consulta más tarde ese
  // mismo día.
  //
  // `enVivo: true` (pedido de gerencia, 11/09/2026 -- "Generar ahora" debe
  // servir a cualquier hora, no solo dentro de la ventana de 1 hora del
  // turno) se salta esa ventana y usa la última lectura de cada unidad en
  // general, como el Mapa en Vivo. Es exclusivo del botón manual: los cron
  // automáticos de scheduler.js nunca pasan este flag, así que su
  // comportamiento no cambia.
  generarReporte = async ({ fecha, turno, enVivo = false } = {}) => {
    await this.dbmsReady;

    const resolvedTurno = (turno || detectTurnoActual() || '').toUpperCase();
    const turnoDef = TURNOS[resolvedTurno];
    if (!turnoDef) {
      throw new Error(JSON.stringify({
        message: "Turno inválido o fuera de horario de reporte. Usa 'turno': 'MATUTINO' | 'VESPERTINO' | 'NOCTURNO'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const resolvedFecha = fecha || veDateISO();
    const { start, end } = buildWindow(resolvedFecha, turnoDef);

    let unidades;
    if (enVivo) {
      const result = await this.dbms.executeNamedQuery({ nameQuery: 'getLatestSnapshots' });
      unidades = result?.rows || [];
    } else {
      const result = await this.dbms.executeNamedQuery({
        nameQuery: 'getSnapshotsInWindow',
        params: { window_start: start.toISOString(), window_end: end.toISOString() },
      });
      unidades = result?.rows || [];

      // El detalle crudo de ventanas viejas se archiva y se borra (ver
      // Archivo.archivarAhora / TRACKER_RETENTION_MONTHS): si ya pasó y no
      // aparece nada en tracker_snapshot, se busca en el resumen permanente
      // antes de reportar "sin lecturas".
      if (unidades.length === 0 && end.getTime() < Date.now()) {
        const summaryResult = await this.dbms.executeNamedQuery({
          nameQuery: 'getSnapshotSummary',
          params: { fecha: resolvedFecha, turno: resolvedTurno },
        });
        unidades = summaryResult?.rows || [];
      }
    }

    // Activas/Estacionadas/Sin señal son mutuamente excluyentes (suman el
    // total): una unidad sin reporte reciente (is_stale) cuenta como "sin
    // señal" en vez de activa o estacionada, aunque su tabla siga mostrando
    // su último estado conocido.
    const total = unidades.length;
    const activas = unidades.filter((r) => r.status === 'ACTIVO' && !r.is_stale).length;
    const estacionadas = unidades.filter((r) => r.status === 'ESTACIONADO' && !r.is_stale).length;
    const sinSenal = unidades.filter((r) => r.is_stale).length;

    return {
      statusCode: STATUS_CODES.OK,
      data: {
        turno: resolvedTurno,
        turno_label: turnoDef.label,
        fecha: resolvedFecha,
        ventana_desde: start.toISOString(),
        ventana_hasta: end.toISOString(),
        total,
        activas,
        estacionadas,
        sin_senal: sinSenal,
        unidades,
      },
    };
  };
}

export default Reporte;
