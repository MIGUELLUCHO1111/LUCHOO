import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import ForesightClient from '../../../tracker/foresightClient.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

const veDateISO = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

// 'wsGetTripsSummary_v1' devuelve horas como texto "H:MM" o "H:MM:SS"
// (ej. "2:25"), igual que el notebook de análisis que ya usaba el equipo.
const timeToHours = (t) => {
  if (t == null || t === '') return 0;
  if (typeof t === 'number') return t;
  const parts = String(t).trim().split(':');
  if (parts.length === 3) return Number(parts[0]) + Number(parts[1]) / 60 + Number(parts[2]) / 3600;
  if (parts.length === 2) return Number(parts[0]) + Number(parts[1]) / 60;
  return Number(parts[0]) || 0;
};

class Comportamiento {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
    this.client = new ForesightClient();
  }

  // Se anexa al reporte del turno Nocturno (fin del día): resume viajes,
  // horas trabajadas/ralentí, distancia y eventos de seguridad (exceso de
  // velocidad, aceleraciones/frenadas/giros bruscos) de TODA la flota con
  // actividad ese día. Usa el mismo reporte "Comportamiento del Conductor"
  // que genera el panel web GEvolution -- una sola llamada para TODAS las
  // unidades (ver ForesightClient.getComportamientoDelDia), no una por
  // unidad como el método anterior (wsGetTripsSummary_v1 +
  // GetEventsNotifications), que chocaba con el límite de peticiones del
  // proveedor apenas la flota superó las ~10 unidades activas por día.
  getAnalisisDelDia = async ({ fecha } = {}) => {
    await this.dbmsReady;

    const resolvedFecha = fecha || veDateISO();
    const startdate = `${resolvedFecha}T00:00:00.000`;
    const enddate = `${resolvedFecha}T23:59:59.999`;

    let filas = [];
    const errores = [];
    try {
      filas = await this.client.getComportamientoDelDia({ startdate, enddate });
    } catch (error) {
      errores.push({ tipo: 'reporte', error: error.message });
    }

    // Igual que el notebook original: descarta filas de servicio del propio GPS.
    const filasLimpias = filas.filter((v) => !/ForesightGPS/i.test(String(v.Unit || '')));

    const topDistancia = filasLimpias
      .map((v) => ({ unidad: v.Unit, km: Number(v.distancetraveled_aUnit) || 0 }))
      .filter((v) => v.km > 0)
      .sort((a, b) => b.km - a.km)
      .slice(0, 10);

    const topRalenti = filasLimpias
      .map((v) => {
        const trabajadas = timeToHours(v.Worked_Hours);
        const ralenti = timeToHours(v.IdleTime);
        return { unidad: v.Unit, movimiento: Math.max(trabajadas - ralenti, 0), ralenti };
      })
      .filter((v) => v.ralenti > 0 || v.movimiento > 0)
      .sort((a, b) => b.ralenti - a.ralenti)
      .slice(0, 10);

    const totales = filasLimpias.reduce(
      (acc, v) => {
        acc.diurnos += Number(v.TripsInDay) || 0;
        acc.nocturnos += Number(v.TripsInNight) || 0;
        acc.mixtos += Number(v.MixedTrips) || 0;
        return acc;
      },
      { diurnos: 0, nocturnos: 0, mixtos: 0 },
    );

    const topExcesosVelocidad = filasLimpias
      .map((v) => ({ unidad: v.Unit, cantidad: Number(v.Speeding) || 0 }))
      .filter((v) => v.cantidad > 0)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);

    const eventosPorTipo = [
      { tipo: 'Exceso de velocidad', cantidad: filasLimpias.reduce((s, v) => s + (Number(v.Speeding) || 0), 0) },
      { tipo: 'Aceleración brusca', cantidad: filasLimpias.reduce((s, v) => s + (Number(v.HarshAcceleration) || 0), 0) },
      { tipo: 'Frenada brusca', cantidad: filasLimpias.reduce((s, v) => s + (Number(v.Harshbreaking) || 0), 0) },
      { tipo: 'Giro brusco', cantidad: filasLimpias.reduce((s, v) => s + (Number(v.sharpturns) || 0), 0) },
    ]
      .filter((e) => e.cantidad > 0)
      .sort((a, b) => b.cantidad - a.cantidad);

    const data = {
      fecha: resolvedFecha,
      unidades_consultadas: filasLimpias.length,
      total_viajes: totales.diurnos + totales.nocturnos + totales.mixtos,
      viajes_diurnos: totales.diurnos,
      viajes_nocturnos: totales.nocturnos,
      viajes_mixtos: totales.mixtos,
      top_distancia: topDistancia,
      top_ralenti: topRalenti,
      eventos_totales: eventosPorTipo.reduce((s, e) => s + e.cantidad, 0),
      top_excesos_velocidad: topExcesosVelocidad,
      eventos_por_tipo: eventosPorTipo,
      errores,
    };

    // Se guarda para no depender de que alguien lo vuelva a pedir desde la
    // pantalla -- permite mostrarlo ya calculado (ver getAnalisisGuardado) y
    // que el cron de madrugada lo deje listo sin intervención manual.
    await this.dbms.executeNamedQuery({
      nameQuery: 'upsertTrackerDailyAnalysis',
      params: {
        fecha: resolvedFecha,
        unidades_consultadas: data.unidades_consultadas,
        total_viajes: data.total_viajes,
        viajes_diurnos: data.viajes_diurnos,
        viajes_nocturnos: data.viajes_nocturnos,
        viajes_mixtos: data.viajes_mixtos,
        top_distancia: JSON.stringify(data.top_distancia),
        top_ralenti: JSON.stringify(data.top_ralenti),
        eventos_totales: data.eventos_totales,
        top_excesos_velocidad: JSON.stringify(data.top_excesos_velocidad),
        eventos_por_tipo: JSON.stringify(data.eventos_por_tipo),
        errores: JSON.stringify(data.errores),
      },
    });

    return { statusCode: STATUS_CODES.OK, data };
  };

  // Trae el análisis ya calculado y guardado para una fecha, sin volver a
  // golpear la API del proveedor -- para que la pantalla lo muestre solo con
  // abrir el turno, en vez de exigir el botón "Generar análisis del día".
  getAnalisisGuardado = async ({ fecha } = {}) => {
    await this.dbmsReady;
    const resolvedFecha = fecha || veDateISO();

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getTrackerDailyAnalysisByFecha',
      params: { fecha: resolvedFecha },
    });
    const row = result?.rows?.[0];
    if (!row) {
      return { statusCode: STATUS_CODES.OK, data: null };
    }

    return {
      statusCode: STATUS_CODES.OK,
      data: {
        fecha: row.fecha,
        unidades_consultadas: row.unidades_consultadas,
        total_viajes: row.total_viajes,
        viajes_diurnos: row.viajes_diurnos,
        viajes_nocturnos: row.viajes_nocturnos,
        viajes_mixtos: row.viajes_mixtos,
        top_distancia: row.top_distancia,
        top_ralenti: row.top_ralenti,
        eventos_totales: row.eventos_totales,
        top_excesos_velocidad: row.top_excesos_velocidad,
        eventos_por_tipo: row.eventos_por_tipo,
        errores: row.errores,
        generated_at: row.generated_at,
      },
    };
  };
}

export default Comportamiento;
