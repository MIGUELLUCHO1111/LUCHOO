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

// La API pide fechas como 'YYYYMMDD HH:MM:SS' (sin guiones).
const toDateParam = (fecha, hora) => `${fecha.replace(/-/g, '')} ${hora}`;

// Pausa entre llamadas para no saturar la API del proveedor (se consulta
// unidad por unidad porque wsGetTripsSummary_v1 exige 'plateno'). El
// proveedor tiene un límite de peticiones por minuto -- comprobado en la
// práctica (ver ForesightClient.extractRows): 104 llamadas en 18s ya lo
// disparó. 800ms entre cada llamada individual es un margen conservador.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CALL_DELAY_MS = Number(process.env.TRACKER_API_CALL_DELAY_MS || 800);

class Comportamiento {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
    this.client = new ForesightClient();
  }

  // Se anexa al reporte del turno Nocturno (fin del día): resume viajes,
  // horas trabajadas/ralentí y distancia de TODA la flota registrada, tal
  // como hacía el notebook "Reporte-Diario-Comportamiento-Conductor-FP"
  // pero sin descargar Excel ni subirlo a mano -- llama a la API de Foresight
  // directamente, una vez por unidad con placa conocida.
  getAnalisisDelDia = async ({ fecha } = {}) => {
    await this.dbmsReady;

    const resolvedFecha = fecha || veDateISO();
    const startdate = toDateParam(resolvedFecha, '00:00:00');
    const enddate = toDateParam(resolvedFecha, '23:59:59');

    // Solo se consultan unidades con actividad confirmada ese día (no toda la
    // tabla interna): de ~68 unidades registradas, la gran mayoría no tiene
    // tracker activo hoy (ver hallazgo de la Fase 1), y consultar cada una
    // igual disparó el límite de peticiones del proveedor en la práctica.
    const activeResult = await this.dbms.executeNamedQuery({ nameQuery: 'getActivePlatesForDate', params: { fecha: resolvedFecha } });
    const plates = [...new Set((activeResult?.rows || []).map((r) => r.plate).filter(Boolean))];

    const viajes = [];
    const eventos = [];
    const errores = [];

    for (const plate of plates) {
      try {
        const rows = await this.client.getTripsSummary({ plateno: plate, startdate, enddate });
        viajes.push(...rows);
      } catch (error) {
        errores.push({ plate, tipo: 'viajes', error: error.message });
      }

      await sleep(CALL_DELAY_MS);

      try {
        const rows = await this.client.getEventsNotifications({ plateno: plate, startdate, enddate });
        eventos.push(...rows.map((e) => ({ ...e, PlateNo: e.PlateNo || plate })));
      } catch (error) {
        errores.push({ plate, tipo: 'eventos', error: error.message });
      }

      await sleep(CALL_DELAY_MS);
    }

    // Igual que el notebook original: descarta filas de servicio del propio GPS.
    const viajesLimpios = viajes.filter((v) => !/ForesightGPS/i.test(String(v.Unit || v.PlateNo || '')));

    const topDistancia = viajesLimpios
      .map((v) => ({ unidad: v.Unit || v.PlateNo, km: Number(v.distancetraveled_aUnit) || 0 }))
      .filter((v) => v.km > 0)
      .sort((a, b) => b.km - a.km)
      .slice(0, 10);

    const topRalenti = viajesLimpios
      .map((v) => {
        const trabajadas = timeToHours(v.Worked_Hours);
        const ralenti = timeToHours(v.IdleTime);
        return { unidad: v.Unit || v.PlateNo, movimiento: Math.max(trabajadas - ralenti, 0), ralenti };
      })
      .filter((v) => v.ralenti > 0 || v.movimiento > 0)
      .sort((a, b) => b.ralenti - a.ralenti)
      .slice(0, 10);

    const totales = viajesLimpios.reduce(
      (acc, v) => {
        acc.diurnos += Number(v.TripsInDay) || 0;
        acc.nocturnos += Number(v.TripsInNight) || 0;
        acc.mixtos += Number(v.MixedTrips) || 0;
        return acc;
      },
      { diurnos: 0, nocturnos: 0, mixtos: 0 },
    );

    // Conteo de eventos de seguridad por unidad y por tipo (ver nota en
    // foresightClient.getEventsNotifications: hoy vuelve vacío para esta
    // cuenta aunque el Dashboard de Seguridad de la plataforma sí muestra
    // datos -- queda listo para cuando se resuelva el acceso).
    const excesosPorUnidad = new Map();
    const eventosPorTipo = new Map();
    for (const e of eventos) {
      const tipo = String(e.EventType || e.EventName || e.Type || e.Description || 'Sin clasificar');
      eventosPorTipo.set(tipo, (eventosPorTipo.get(tipo) || 0) + 1);

      if (/veloc|speed/i.test(tipo)) {
        const unidad = e.PlateNo || 'Desconocida';
        excesosPorUnidad.set(unidad, (excesosPorUnidad.get(unidad) || 0) + 1);
      }
    }

    return {
      statusCode: STATUS_CODES.OK,
      data: {
        fecha: resolvedFecha,
        unidades_consultadas: plates.length,
        total_viajes: totales.diurnos + totales.nocturnos + totales.mixtos,
        viajes_diurnos: totales.diurnos,
        viajes_nocturnos: totales.nocturnos,
        viajes_mixtos: totales.mixtos,
        top_distancia: topDistancia,
        top_ralenti: topRalenti,
        eventos_totales: eventos.length,
        top_excesos_velocidad: [...excesosPorUnidad.entries()]
          .map(([unidad, cantidad]) => ({ unidad, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad)
          .slice(0, 10),
        eventos_por_tipo: [...eventosPorTipo.entries()]
          .map(([tipo, cantidad]) => ({ tipo, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad),
        errores,
      },
    };
  };
}

export default Comportamiento;
