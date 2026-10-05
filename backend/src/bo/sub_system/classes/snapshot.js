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

// Codigo comparado sin guiones, puntos ni espacios: "FPCSL08" y "FP-CSL.08"
// son la misma unidad (no se renombra por eso).
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Liviana o Pesada segun el tipo de vehiculo que tiene la unidad en el GPS
// (TObjectTypeName de la API oficial v3: "PICK UP 1", "Camion", "GRUA",
// "Tractor", "Camión Cava"...). Si no se reconoce, queda sin clasificar y la
// lista de Flota lo avisa. Pedido de Lguerra, 05/10/2026.
const PESADA_RE = /cami[oó]n|cabina|chuto|tractor|gr[uú]a|montacarga|cargador|cava|gandola|volteo|cisterna|brazo|cesta|plataforma|retro|excavadora|tanque|bus\b|autob[uú]s|maquinaria|compactador/i;
const LIVIANA_RE = /pick\s*-?up|camioneta|autom[oó]vil|\bauto\b|sed[aá]n|\bvan\b|moto|r[uú]stico|jeep|\bcarro\b|hatchback|suv/i;
export const fleetTypeFromGps = (typeName) => {
  const t = String(typeName || '');
  if (!t) return null;
  if (LIVIANA_RE.test(t)) return 'LIVIANA';
  if (PESADA_RE.test(t)) return 'PESADA';
  return null;
};

class Snapshot {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
    this.client = new ForesightClient();
    this.alerta = new Alerta();
  }

  // Tipo de flota de una unidad nueva: una sola consulta a la API v3 (solo
  // al auto-registrar, no en cada sincronizacion). Si falla, sin clasificar.
  tipoDeFlotaDelGps = async (plate) => {
    try {
      const estado = await this.client.getEstadoActualV3(plate);
      return fleetTypeFromGps(estado?.TObjectTypeName);
    } catch (error) {
      console.error(`[Tracker] No se pudo consultar el tipo de vehiculo de ${plate}:`, error?.message || error);
      return null;
    }
  };

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
    const byCode = new Map();
    for (const u of registryResult?.rows || []) {
      if (u.plate) byPlate.set(String(u.plate).trim().toUpperCase(), u);
      if (u.code) byCode.set(String(u.code).trim().toUpperCase(), u);
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

      // Si en GEvolution le cambiaron el nombre a una unidad ya registrada
      // (ej. "FPVA09" -> "FP-BA.09"), el codigo de la app se actualiza solo
      // y queda en su historial (pedido de Lguerra, 05/10/2026). Solo si el
      // nombre nuevo no es el codigo de otra unidad.
      if (unit && raw.Name && normCode(raw.Name) && normCode(raw.Name) !== normCode(unit.code)) {
        const nuevo = String(raw.Name).trim();
        const otra = byCode.get(nuevo.toUpperCase());
        if (!otra || otra.id === unit.id) {
          try {
            const r = await this.dbms.executeNamedQuery({ nameQuery: 'renameFleetUnitCode', params: { id: Number(unit.id), code: nuevo } });
            const renamed = r?.rows?.[0];
            if (renamed) {
              await this.dbms.executeNamedQuery({
                nameQuery: 'insertFleetUnitEvent',
                params: { unit_id: Number(unit.id), event_type: 'EDICION', title: `Código ${nuevo}`, detail: `Antes: ${unit.code}. Se tomó el nombre nuevo que tiene en el GPS.`, created_by: 'sistema' },
              });
              console.log(`[Tracker] Unidad renombrada desde el GPS: ${unit.code} -> ${nuevo} (placa ${plate})`);
              byCode.delete(String(unit.code).toUpperCase());
              byCode.set(nuevo.toUpperCase(), renamed);
              byPlate.set(plateKey, renamed);
              unit = renamed;
            }
          } catch (error) {
            console.error(`[Tracker] No se pudo renombrar ${unit.code} -> ${nuevo}:`, error?.message || error);
          }
        }
      }

      // Auto-registro (pedido de Lguerra, 18/09/2026): la plataforma ya le
      // pone un código a cada unidad (raw.Name, ej. "FP-CSL.07") -- en vez
      // de dejarla "sin registrar" hasta que alguien la note en un reporte,
      // se da de alta sola con ese código y "ROTATIVO" de conductor por
      // defecto (el mismo valor que ya usa la mayoría de la flota sin
      // conductor fijo asignado), igual que si se hubiera creado a mano
      // desde Gestión de Unidades.
      if (!unit && plateKey && raw.Name) {
        const code = String(raw.Name).trim();
        const codeKey = code.toUpperCase();
        // El cruce de arriba es solo por placa: varias unidades ya existían
        // en el registro con código pero sin placa (creadas a mano antes de
        // tener este dato). Si no matcheó por placa pero SÍ existe por
        // código, es esa misma unidad -- rellenar la placa que faltaba, no
        // intentar crear una fila nueva (choca con la restricción única del
        // código y quedaba sin auto-registrar en cada sync, en silencio).
        const existingByCode = byCode.get(codeKey);
        if (existingByCode) {
          try {
            const updateResult = await this.dbms.executeNamedQuery({
              nameQuery: 'setTrackerUnitPlateIfMissing',
              params: { code, plate },
            });
            unit = updateResult?.rows?.[0] || existingByCode;
            byPlate.set(plateKey, unit);
            if (updateResult?.rows?.[0]) {
              console.log(`[Tracker] Placa completada para unidad existente: ${code} (placa ${plate})`);
            }
          } catch (error) {
            console.error(`[Tracker] No se pudo completar la placa de la unidad ${code} (placa ${plate}):`, error?.message || error);
            unit = existingByCode;
          }
        } else {
          try {
            const fleetType = await this.tipoDeFlotaDelGps(plate);
            const createResult = await this.dbms.executeNamedQuery({
              nameQuery: 'createTrackerUnit',
              params: { code, plate, driver_name: 'ROTATIVO', fleet_type: fleetType },
            });
            unit = createResult?.rows?.[0];
            if (unit) {
              byPlate.set(plateKey, unit);
              byCode.set(codeKey, unit);
              console.log(`[Tracker] Unidad nueva auto-registrada: ${code} (placa ${plate}, flota ${fleetType || 'sin clasificar'})`);
            }
          } catch (error) {
            console.error(`[Tracker] No se pudo auto-registrar la unidad ${code} (placa ${plate}):`, error?.message || error);
          }
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
