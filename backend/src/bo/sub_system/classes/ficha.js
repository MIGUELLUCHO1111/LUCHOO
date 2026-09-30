import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import ForesightClient from '../../../tracker/foresightClient.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Ficha de Vehiculos (modulo Flota, pedido de Lguerra 30/09/2026): junta en
// una sola ficha por unidad lo que ya sabe el tracker (fleet_unit + ultima
// lectura GPS), lo que trae la API oficial v3 (odometro, equipo GPS) y los
// datos que el GPS no tiene y se cargan a mano (marca, chasis, seguros,
// mantenimientos). Tablas en 043_fleet_ficha.sql.

// Columnas editables de fleet_unit_profile y su tipo (para limpiar lo que
// llega del formulario antes de armar el patch JSON de fleetUpdateProfile).
const PROFILE_FIELDS = {
  operational_status: 'status', status_cause: 'text', short_code: 'text',
  brand: 'text', model: 'text', model_year: 'int', vin: 'text', engine_serial: 'text', color: 'text', fuel_type: 'text',
  assigned_zone: 'text', driver_phone: 'text', driver_assigned_at: 'date', next_driver: 'text',
  change_plan: 'bool', fleet_manager: 'text', avg_consumption_kml: 'num',
  odometer_km: 'num', odometer_at: 'date', maint_interval_km: 'int', last_maint_km: 'num', last_maint_at: 'date',
  order_date: 'date', registration_date: 'date', cancellation_date: 'date', first_contract_date: 'date',
  hp_tax: 'num', catalog_value: 'num', purchase_value: 'num', residual_value: 'num', tags: 'text',
};
const UNIT_FIELDS = ['driver_name', 'fleet_type', 'name', 'tank_capacity_liters'];
// Condicion operativa de la politica FP-MTTO-PO-01 §4.1 (047_fleet_policy_states.sql).
// La cambiara Mantenimiento al abrir/cerrar una OT; mientras tanto, solo un admin.
const STATUSES = ['OPERATIVO_CONTRATO', 'STANDBY', 'DISPONIBLE', 'FUERA_DE_SERVICIO'];
const STATUS_LABEL = { OPERATIVO_CONTRATO: 'Operativo en contrato', STANDBY: 'Standby / back-up', DISPONIBLE: 'Disponible', FUERA_DE_SERVICIO: 'Fuera de servicio' };
const STATUS_EDITORS = ['admin'];
const SETTING_KEYS = ['MAINT_INTERVAL_LIVIANA', 'MAINT_INTERVAL_PESADA', 'DOC_ALERT_DAYS'];

// La API v3 corta tras ~10 consultas seguidas: se guarda en memoria lo que
// devolvio cada placa y solo se vuelve a preguntar pasados 15 minutos.
const GPS_CACHE_MS = 15 * 60 * 1000;
const gpsCache = new Map();

const badRequest = (message) => new Error(JSON.stringify({ message, statusCode: STATUS_CODES.BAD_REQUEST }));
const notFound = (message) => new Error(JSON.stringify({ message, statusCode: STATUS_CODES.NOT_FOUND }));

const clean = (value, type) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return type === 'bool' ? false : null;
  switch (type) {
    case 'int': { const n = parseInt(value, 10); return Number.isFinite(n) ? n : null; }
    case 'num': { const n = Number(String(value).replace(',', '.')); return Number.isFinite(n) ? n : null; }
    case 'bool': return value === true || value === 'true';
    case 'date': return /^\d{4}-\d{2}-\d{2}/.test(String(value)) ? String(value).slice(0, 10) : null;
    case 'status': return STATUSES.includes(value) ? value : undefined;
    default: return String(value).trim() || null;
  }
};

// El validador de consultas rechaza enteros en 'float': los numeros van como
// texto y se castean en SQL (::numeric).
const numStr = (n) => (n == null ? null : String(n));

const normPlate = (p) => String(p || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();

// "YYYYMMDD HH:MM:SS" en hora de Venezuela, formato que pide la API v3.
const v3Date = (date) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}${parts.month}${parts.day} ${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}:${parts.second}`;
};

class Ficha {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
    this.gps = new ForesightClient();
  }

  query = async (nameQuery, params = {}) => {
    await this.dbmsReady;
    const result = await this.dbms.executeNamedQuery({ nameQuery, params });
    return result?.rows || [];
  };

  evento = (unit_id, event_type, title, detail, created_by) =>
    this.query('fleetInsertEvent', { unit_id, event_type, title, detail: detail || null, created_by: created_by || null });

  snapshotsPorPlaca = async () => {
    // Misma consulta que Estado de Flota: ubicacion con alias y categoria.
    const rows = await this.query('getLatestSnapshots');
    return new Map(rows.map((r) => [normPlate(r.plate), r]));
  };

  // Datos de la API v3 para una placa (con cache). Nunca rompe la ficha: si la
  // API no ve la placa o corta por rate limit, se devuelve lo ultimo que haya.
  datosGps = async (plate) => {
    if (!plate) return { disponible: false, motivo: 'La unidad no tiene placa registrada' };
    const key = normPlate(plate);
    const cached = gpsCache.get(key);
    if (cached && Date.now() - cached.at < GPS_CACHE_MS) return cached.data;

    try {
      const estado = await this.gps.getEstadoActualV3(plate);
      let dias = [];
      if (estado) {
        const now = new Date();
        dias = await this.gps.getOdometroV3({
          plate, startdate: v3Date(new Date(now.getTime() - 29 * 86400000)).slice(0, 8) + ' 00:00:00', enddate: v3Date(now),
        });
      }
      const data = estado
        ? {
            disponible: true,
            odometro_km: Number(estado.Odometer) || null,
            tipo_vehiculo: estado.TObjectTypeName || null,
            imei: estado.IMEI || null,
            sim: estado.ICCID || null,
            bateria: estado.BatteryLevel != null ? Number(estado.BatteryLevel) : null,
            combustible_pct: Number(estado.FuelLevelPercent) || null,
            estado_gps: estado.TObjectStatusName || null,
            ultimo_reporte: estado.LastReported || estado.LastTime || null,
            km_por_dia: dias
              .map((d) => ({ fecha: String(d.From || '').slice(0, 10), km: Number(d.Odometer_aUnit) || 0, total: Number(d.Total_odometer_aUnit) || null }))
              .filter((d) => d.fecha)
              .sort((a, b) => a.fecha.localeCompare(b.fecha)),
          }
        : { disponible: false, motivo: 'El usuario de la API v3 todavía no tiene esta unidad asignada' };
      gpsCache.set(key, { at: Date.now(), data });
      return data;
    } catch (error) {
      if (cached) return cached.data;
      return { disponible: false, motivo: error?.isRateLimit ? 'La API del GPS pidió esperar unos minutos (límite de consultas)' : 'No se pudo consultar la API del GPS' };
    }
  };

  listar = async () => {
    const [unidades, snaps] = await Promise.all([this.query('fleetListUnits'), this.snapshotsPorPlaca()]);
    const data = unidades.map((u) => {
      const s = snaps.get(normPlate(u.plate));
      return {
        ...u,
        gps: s ? { status: s.status, is_stale: s.is_stale, location_text: s.location_text, location_category: s.location_category, last_report_at: s.last_report_at, ignition: s.ignition } : null,
      };
    });
    return { statusCode: STATUS_CODES.OK, data };
  };

  obtener = async ({ id }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    const [unidad] = await this.query('fleetGetUnit', { id });
    if (!unidad) throw notFound(`Unidad con id ${id} no encontrada`);

    const [documentos, servicios, eventos, snaps, gps] = await Promise.all([
      this.query('fleetListDocuments', { unit_id: id }),
      this.query('fleetListServices', { unit_id: id }),
      this.query('fleetListEvents', { unit_id: id }),
      this.snapshotsPorPlaca(),
      this.datosGps(unidad.plate),
    ]);
    const snapshot = snaps.get(normPlate(unidad.plate)) || null;

    // Odometro: el mas reciente entre el del GPS (v3) y el cargado a mano.
    const p = unidad.profile || {};
    let odometro = null;
    if (gps.disponible && gps.odometro_km) odometro = { km: gps.odometro_km, fuente: 'GPS', fecha: gps.ultimo_reporte };
    if (p.odometer_km != null && (!odometro || (p.odometer_at && p.odometer_at > String(odometro.fecha || '').slice(0, 10)))) {
      odometro = { km: Number(p.odometer_km), fuente: 'MANUAL', fecha: p.odometer_at || null };
    }

    return { statusCode: STATUS_CODES.OK, data: { ...unidad, documentos, servicios, eventos, snapshot, gps_v3: gps, odometro } };
  };

  guardar = async ({ id, caller_user, caller_profile, ...campos }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    const [actual] = await this.query('fleetGetUnit', { id });
    if (!actual) throw notFound(`Unidad con id ${id} no encontrada`);
    const prev = actual.profile || {};

    const patch = {};
    for (const [k, type] of Object.entries(PROFILE_FIELDS)) {
      const v = clean(campos[k], type);
      if (v !== undefined) patch[k] = v;
    }
    const cambiosUnidad = UNIT_FIELDS.some((k) => campos[k] !== undefined);
    const cambiaEstado = (patch.operational_status && patch.operational_status !== (prev.operational_status || 'DISPONIBLE')) || (patch.status_cause !== undefined && patch.status_cause !== (prev.status_cause ?? null));
    if (cambiaEstado && !STATUS_EDITORS.includes(String(caller_profile || '').toLowerCase())) {
      throw new Error(JSON.stringify({ message: 'Solo un administrador puede cambiar la condición operativa (luego la cambiará Mantenimiento).', statusCode: STATUS_CODES.FORBIDDEN }));
    }
    if (patch.operational_status && patch.operational_status !== 'FUERA_DE_SERVICIO' && patch.status_cause === undefined) patch.status_cause = null;
    if (patch.operational_status === 'FUERA_DE_SERVICIO' && !(patch.status_cause ?? prev.status_cause)) throw badRequest('Indica la causa de Fuera de servicio (ej. En reparación, Sin componente mayor).');

    if (cambiosUnidad) {
      const fleetType = campos.fleet_type !== undefined ? (['LIVIANA', 'PESADA'].includes(campos.fleet_type) ? campos.fleet_type : null) : actual.fleet_type;
      await this.query('fleetUpdateUnitBasics', {
        id,
        driver_name: campos.driver_name !== undefined ? clean(campos.driver_name, 'text') : actual.driver_name,
        fleet_type: fleetType,
        name: campos.name !== undefined ? clean(campos.name, 'text') : actual.name,
        tank_capacity_liters: numStr(campos.tank_capacity_liters !== undefined ? clean(campos.tank_capacity_liters, 'num') : actual.tank_capacity_liters),
      });
    }
    if (Object.keys(patch).length) {
      await this.query('fleetEnsureProfile', { unit_id: id });
      await this.query('fleetUpdateProfile', { unit_id: id, patch: JSON.stringify(patch) });
    }

    // Historial: los cambios que importan van con su propio evento.
    const quien = caller_user || null;
    const nuevoConductor = campos.driver_name !== undefined ? clean(campos.driver_name, 'text') : undefined;
    if (nuevoConductor !== undefined && nuevoConductor !== actual.driver_name) {
      await this.evento(id, 'CONDUCTOR', `Cambio de conductor: ${nuevoConductor || 'sin asignar'}`, actual.driver_name ? `Antes: ${actual.driver_name}` : null, quien);
    }
    if (patch.operational_status && patch.operational_status !== (prev.operational_status || 'DISPONIBLE')) {
      const causa = patch.operational_status === 'FUERA_DE_SERVICIO' ? ` (${patch.status_cause || prev.status_cause})` : '';
      await this.evento(id, 'ESTADO', `Condición: ${STATUS_LABEL[patch.operational_status]}${causa}`, `Antes: ${STATUS_LABEL[prev.operational_status] || 'Disponible'}`, quien);
    }
    if (patch.assigned_zone !== undefined && patch.assigned_zone !== (prev.assigned_zone ?? null)) {
      await this.evento(id, 'UBICACION', `Zona asignada: ${patch.assigned_zone || 'sin zona'}`, null, quien);
    }
    if (patch.odometer_km != null && Number(patch.odometer_km) !== Number(prev.odometer_km)) {
      await this.evento(id, 'ODOMETRO', `Odómetro actualizado: ${Number(patch.odometer_km).toLocaleString('es-VE')} km`, null, quien);
    }
    const otros = Object.keys(patch).filter((k) => !['operational_status', 'status_cause', 'assigned_zone', 'odometer_km', 'odometer_at'].includes(k) && String(patch[k] ?? '') !== String(prev[k] ?? ''));
    if (otros.length || (cambiosUnidad && ['fleet_type', 'name', 'tank_capacity_liters'].some((k) => campos[k] !== undefined && String(campos[k] ?? '') !== String(actual[k] ?? '')))) {
      await this.evento(id, 'EDICION', 'Ficha actualizada', null, quien);
    }

    return this.obtener({ id });
  };

  guardarDocumento = async ({ unit_id, doc_type, name, number, provider, issued_at, expires_at, notes, caller_user }) => {
    if (!unit_id || !name || !doc_type) throw badRequest("Campos requeridos: 'unit_id', 'doc_type' y 'name'");
    const [doc] = await this.query('fleetInsertDocument', {
      unit_id, doc_type, name: String(name).trim(),
      number: clean(number, 'text'), provider: clean(provider, 'text'),
      issued_at: clean(issued_at, 'date'), expires_at: clean(expires_at, 'date'), notes: clean(notes, 'text'),
    });
    const vence = clean(expires_at, 'date');
    await this.evento(unit_id, 'DOCUMENTO', `Documento agregado: ${name}`, vence ? `Vence: ${vence.split('-').reverse().join('/')}` : null, caller_user);
    return { statusCode: STATUS_CODES.CREATED, data: doc, message: 'Documento agregado' };
  };

  eliminarDocumento = async ({ id, caller_user }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    const [doc] = await this.query('fleetDeleteDocument', { id });
    if (!doc) throw notFound(`Documento con id ${id} no encontrado`);
    await this.evento(doc.unit_id, 'DOCUMENTO', `Documento eliminado: ${doc.name}`, null, caller_user);
    return { statusCode: STATUS_CODES.OK, message: 'Documento eliminado' };
  };

  registrarServicio = async ({ unit_id, service_at, service_type = 'PREVENTIVO', odometer_km, description, workshop, cost, caller_user }) => {
    const fecha = clean(service_at, 'date');
    if (!unit_id || !fecha || !description) throw badRequest("Campos requeridos: 'unit_id', 'service_at' y 'description'");
    const tipo = ['PREVENTIVO', 'CORRECTIVO', 'OTRO'].includes(service_type) ? service_type : 'OTRO';
    const km = clean(odometer_km, 'num');
    const [svc] = await this.query('fleetInsertService', {
      unit_id, service_at: fecha, service_type: tipo, odometer_km: numStr(km),
      description: String(description).trim(), workshop: clean(workshop, 'text'), cost: numStr(clean(cost, 'num')),
    });
    // Un preventivo reinicia la cuenta hacia el proximo mantenimiento.
    if (tipo === 'PREVENTIVO') {
      await this.query('fleetEnsureProfile', { unit_id });
      await this.query('fleetUpdateProfile', { unit_id, patch: JSON.stringify({ last_maint_at: fecha, ...(km != null ? { last_maint_km: km } : {}) }) });
    }
    const etiqueta = { PREVENTIVO: 'Mantenimiento preventivo', CORRECTIVO: 'Mantenimiento correctivo', OTRO: 'Servicio' }[tipo];
    await this.evento(unit_id, 'MANTENIMIENTO', `${etiqueta}: ${description}`, km != null ? `${km.toLocaleString('es-VE')} km` : null, caller_user);
    return { statusCode: STATUS_CODES.CREATED, data: svc, message: 'Servicio registrado' };
  };

  eliminarServicio = async ({ id, caller_user }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    const [svc] = await this.query('fleetDeleteService', { id });
    if (!svc) throw notFound(`Servicio con id ${id} no encontrado`);
    await this.evento(svc.unit_id, 'MANTENIMIENTO', `Servicio eliminado: ${svc.description}`, null, caller_user);
    return { statusCode: STATUS_CODES.OK, message: 'Servicio eliminado' };
  };

  agregarNota = async ({ unit_id, texto, caller_user }) => {
    const t = clean(texto, 'text');
    if (!unit_id || !t) throw badRequest("Campos requeridos: 'unit_id' y 'texto'");
    await this.evento(unit_id, 'NOTA', t.length > 190 ? `${t.slice(0, 187)}...` : t, t.length > 190 ? t : null, caller_user);
    return { statusCode: STATUS_CODES.CREATED, message: 'Nota agregada' };
  };

  getAjustes = async () => {
    const rows = await this.query('fleetGetSettings');
    return { statusCode: STATUS_CODES.OK, data: Object.fromEntries(rows.map((r) => [r.key, Number(r.value)])) };
  };

  guardarAjustes = async (params) => {
    for (const key of SETTING_KEYS) {
      if (params[key] === undefined) continue;
      const n = parseInt(params[key], 10);
      if (!Number.isFinite(n) || n <= 0) throw badRequest(`Valor inválido para ${key}`);
      await this.query('fleetSetSetting', { key, value: String(n) });
    }
    return this.getAjustes();
  };
}

export default Ficha;
