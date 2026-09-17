import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import ForesightClient from '../../../tracker/foresightClient.js';
import Alerta from './alerta.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Unidades sin reporte más reciente que esta ventana se marcan is_stale
// (la propuesta detectó trackers con última señal de 2010-2021 en la misma
// cuenta de API; sin este filtro generarían alertas/reportes falsos).
const STALE_HOURS = Number(process.env.TRACKER_STALE_HOURS || 24);

class Snapshot {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
    this.client = new ForesightClient();
    this.alerta = new Alerta();
  }

  // Fase 1 - motor de datos: llama a la API una vez (toda la flota),
  // cruza cada unidad por placa contra la tabla interna, y guarda una fila
  // de historial por unidad recibida.
  syncNow = async () => {
    await this.dbmsReady;

    let units;
    try {
      units = await this.client.getCurrentUnitsStatus();
    } catch (error) {
      throw new Error(JSON.stringify({
        message: `No se pudo conectar con la API de Foresight GPS: ${error.message}`,
        statusCode: STATUS_CODES.DB_ERROR,
      }));
    }

    const registryResult = await this.dbms.executeNamedQuery({ nameQuery: 'getAllTrackerUnits' });
    const byPlate = new Map();
    for (const u of registryResult?.rows || []) {
      if (u.plate) byPlate.set(String(u.plate).trim().toUpperCase(), u);
    }

    const now = Date.now();
    let matched = 0;

    for (const raw of units) {
      // Se recorta aqui (no solo para esta comparacion) porque el mismo
      // valor se guarda tal cual en tracker_snapshot.plate, y las consultas
      // de lectura (getLatestSnapshots, getSnapshotsInWindow) cruzan por
      // igualdad exacta de SQL contra tracker_unit.plate -- un espacio de
      // mas que trajera la API (visto en una unidad real) rompia ese cruce
      // aunque el matching de aqui arriba ya lo tolerara.
      const plate = raw.PlateNo ? String(raw.PlateNo).trim() : null;
      const plateKey = plate ? plate.toUpperCase() : null;
      let unit = plateKey ? byPlate.get(plateKey) : null;

      // Auto-registro (pedido de Lguerra, 18/09/2026): la plataforma ya le
      // pone un código a cada unidad (raw.Name, ej. "FP-CSL.07") -- en vez
      // de dejarla "sin registrar" hasta que alguien la note en un reporte,
      // se da de alta sola con ese código y "ROTATIVO" de conductor por
      // defecto (el mismo valor que ya usa la mayoría de la flota sin
      // conductor fijo asignado), igual que si se hubiera creado a mano
      // desde Gestión de Unidades.
      if (!unit && plateKey && raw.Name) {
        const code = String(raw.Name).trim();
        try {
          const createResult = await this.dbms.executeNamedQuery({
            nameQuery: 'createTrackerUnit',
            params: { code, plate, driver_name: 'ROTATIVO', fleet_type: null },
          });
          unit = createResult?.rows?.[0];
          if (unit) {
            byPlate.set(plateKey, unit);
            console.log(`[Tracker] Unidad nueva auto-registrada: ${code} (placa ${plate})`);
          }
        } catch (error) {
          console.error(`[Tracker] No se pudo auto-registrar la unidad ${code} (placa ${plate}):`, error?.message || error);
        }
      }
      if (unit) matched += 1;

      // El proveedor a veces devuelve literalmente "False" en vez de una
      // direccion (falla puntual de su lado, confirmado contra la respuesta
      // cruda de la API) -- se descarta para no mostrar "FALSE" como si
      // fuera un lugar real.
      let locationText = raw.Location ? String(raw.Location).trim() : null;
      if (locationText && /^(false|true)$/i.test(locationText)) locationText = null;

      const lastReportAt = raw.LastTime || null;
      const ageMs = lastReportAt ? now - new Date(lastReportAt).getTime() : Infinity;
      const isStale = !(ageMs <= STALE_HOURS * 60 * 60 * 1000);
      const status = raw.Ignition ? 'ACTIVO' : 'ESTACIONADO';

      await this.dbms.executeNamedQuery({
        nameQuery: 'insertTrackerSnapshot',
        params: {
          unit_id: unit ? unit.id : null,
          gps_unit_id: raw.ID ?? null,
          plate,
          gps_name: raw.Name || null,
          location_text: locationText,
          latitude: raw.yLat ?? null,
          longitude: raw.xLong ?? null,
          speed: raw.Speed ?? null,
          ignition: raw.Ignition ?? null,
          status,
          is_stale: isStale,
          last_report_at: lastReportAt,
          raw_response: JSON.stringify(raw),
        },
      });
    }

    const latest = await this.dbms.executeNamedQuery({ nameQuery: 'getLatestSnapshots' });
    try {
      await this.alerta.evaluateSnapshots(latest?.rows || []);
    } catch (error) {
      console.error('[Tracker] Error evaluando alertas:', error);
    }

    return {
      statusCode: STATUS_CODES.OK,
      data: { total_recibidas: units.length, cruzadas_con_tabla_interna: matched },
      message: `Sincronización completa: ${units.length} unidades recibidas de la API, ${matched} cruzadas con la tabla interna de unidades`,
    };
  };

  // Corre la misma sincronización sin pasar por el dispatcher (usado por el
  // cron interno). Devuelve el mismo resultado; los errores se loguean pero
  // no interrumpen el proceso del servidor.
  runScheduledSync = async () => {
    try {
      const result = await this.syncNow();
      console.log(`[Tracker] Sincronización automática: ${result.message}`);
    } catch (error) {
      console.error('[Tracker] Error en sincronización automática:', error?.message || error);
    }
  };

  getLatestSnapshots = async () => {
    await this.dbmsReady;

    const result = await this.dbms.executeNamedQuery({ nameQuery: 'getLatestSnapshots' });
    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };
}

export default Snapshot;
