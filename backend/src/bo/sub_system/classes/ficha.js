import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import ForesightClient from '../../../tracker/foresightClient.js';
import { assertUnitAccess, assertAdmin, canEditUnit, isAdminCaller } from './fleetAccess.js';
import Lectura, { resumenLecturas } from './lectura.js';

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
  brand: 'text', model: 'text', model_year: 'int', vin: 'text', engine_serial: 'text', engine_type: 'text', color: 'text', fuel_type: 'text',
  assigned_zone: 'text', driver_phone: 'text', driver_assigned_at: 'date', next_driver: 'text',
  change_plan: 'bool', fleet_manager: 'text', avg_consumption_kml: 'num',
  maint_interval_km: 'int', last_maint_km: 'num', last_maint_at: 'date',
  order_date: 'date', registration_date: 'date', cancellation_date: 'date', first_contract_date: 'date',
  hp_tax: 'num', catalog_value: 'num', purchase_value: 'num', residual_value: 'num', tags: 'text',
};
// Equipos estaticos (vacuum, maquinas de soldar, compresores; 069, 08/10/2026).
const FLEET_TYPES = ['LIVIANA', 'PESADA', 'ESTATICO'];
const UNIT_FIELDS = ['driver_name', 'fleet_type', 'name', 'tank_capacity_liters'];
// Condicion operativa de la politica FP-MTTO-PO-01 §4.1 (047_fleet_policy_states.sql).
// La cambiara Mantenimiento al abrir/cerrar una OT; mientras tanto, solo un admin.
const STATUSES = ['OPERATIVO_CONTRATO', 'DISPONIBLE', 'FUERA_DE_SERVICIO']; // Standby se quito el 05/10/2026 (052)
const STATUS_LABEL = { OPERATIVO_CONTRATO: 'Operativo en contrato', DISPONIBLE: 'Disponible', FUERA_DE_SERVICIO: 'Fuera de servicio' };
const STATUS_EDITORS = ['admin'];
const SETTING_KEYS = ['MAINT_INTERVAL_LIVIANA', 'MAINT_INTERVAL_PESADA', 'DOC_ALERT_DAYS', 'IDLE_ALERT_DAYS'];
const DAY_MS = 86400000;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Equipo parado (pedido de Lguerra, 07/10/2026): dias desde la ultima vez que
// el GPS lo vio encendido o andando. Si nunca se lo vio moverse, cuenta desde
// la primera lectura que hay de esa placa (los datos empiezan el 10/09/2026).
const paradaDe = (mov, alertDays) => {
  if (!mov) return null;
  const ref = mov.last_moved_at || mov.first_seen;
  if (!ref) return null;
  const dias = Math.max(0, Math.floor((Date.now() - new Date(ref).getTime()) / DAY_MS));
  return { dias, desde: ref, nunca_se_movio: !mov.last_moved_at, alerta: dias >= alertDays, dias_alerta: alertDays };
};

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
    this.lectura = new Lectura();
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

  // Nombre unico a proposito: los permisos se guardan por nombre de metodo
  // (method_profile no tiene la clase) y 'listar' existe tambien en clases
  // del Tracker -- darselo a otro perfil le abriria esas tambien.
  listarFichas = async ({ caller_profile, caller_user_id } = {}) => {
    const [unidades, snaps, encargados, docs, conLectura, movimientos, frentes, conductores, ajustes] = await Promise.all([
      this.query('fleetListUnits'), this.snapshotsPorPlaca(), this.query('fleetCurrentManagers'), this.query('fleetDocsSummary'), this.query('fleetUnitsWithReadings'),
      this.query('fleetLastMovement'), this.query('fleetCurrentAssignments'), this.query('fleetCurrentDrivers'), this.query('fleetGetSettings'),
    ]);
    const idleDays = Number(ajustes.find((a) => a.key === 'IDLE_ALERT_DAYS')?.value) || 90;
    const movPorPlaca = new Map(movimientos.map((m) => [m.plate_norm, m]));
    const frentePorUnidad = new Map(frentes.map((x) => [String(x.unit_id), x]));
    const conductorPorUnidad = new Map(conductores.map((x) => [String(x.unit_id), x]));
    const tieneLectura = new Set(conLectura.map((r) => String(r.unit_id)));
    const porUnidad = new Map(encargados.map((m) => [String(m.unit_id), m]));
    const docsPorUnidad = docs.reduce((acc, d) => {
      (acc[d.unit_id] = acc[d.unit_id] || []).push({ doc_type: d.doc_type, has_file: d.has_file, days_left: d.days_left });
      return acc;
    }, {});
    const admin = isAdminCaller(caller_profile);
    const data = unidades.map((u) => {
      const s = snaps.get(normPlate(u.plate));
      const m = porUnidad.get(String(u.id));
      const mia = !!(m && caller_user_id && Number(m.user_id) === Number(caller_user_id));
      return {
        ...u,
        encargado: m ? { user_id: Number(m.user_id), nombre: m.display_name, telefono: m.phone || null, desde: m.assigned_at } : null,
        docs_resumen: docsPorUnidad[u.id] || [],
        // Odometro del GPS solo si ya se consulto (cache de la API v3): la lista no pregunta por cada placa.
        odometro_gps: gpsCache.get(normPlate(u.plate))?.data?.odometro_km ?? null,
        tiene_lectura: tieneLectura.has(String(u.id)),
        parada: paradaDe(movPorPlaca.get(normPlate(u.plate)), idleDays),
        frente: frentePorUnidad.get(String(u.id)) || null,
        conductor: conductorPorUnidad.get(String(u.id)) || null,
        soy_encargado: mia,
        puede_editar: admin || mia,
        gps: s ? { status: s.status, is_stale: s.is_stale, location_text: s.location_text, location_category: s.location_category, last_report_at: s.last_report_at, ignition: s.ignition } : null,
      };
    });
    return { statusCode: STATUS_CODES.OK, data };
  };

  obtener = async ({ id, caller_profile, caller_user_id }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    const [unidad] = await this.query('fleetGetUnit', { id });
    if (!unidad) throw notFound(`Unidad con id ${id} no encontrada`);

    const [documentos, servicios, eventos, snaps, gps, encargados, puedeEditar, frentes, conductores, movimientos, ajustes] = await Promise.all([
      this.query('fleetListDocuments', { unit_id: id }),
      this.query('fleetListServices', { unit_id: id }),
      this.query('fleetListEvents', { unit_id: id }),
      this.snapshotsPorPlaca(),
      this.datosGps(unidad.plate),
      this.query('fleetManagerHistory', { unit_id: id }),
      canEditUnit(this.dbms, { caller_profile, caller_user_id, unit_id: id }),
      this.query('fleetAssignmentHistory', { unit_id: id }),
      this.query('fleetDriverHistory', { unit_id: id }),
      this.query('fleetLastMovement'),
      this.query('fleetGetSettings'),
    ]);
    const idleDays = Number(ajustes.find((a) => a.key === 'IDLE_ALERT_DAYS')?.value) || 90;
    const [conductorActual] = (await this.query('fleetCurrentDrivers')).filter((c) => Number(c.unit_id) === Number(id));
    const actual = encargados.find((m) => !m.ended_at) || null;
    // La lectura del GPS se guarda en el historial (una vez al dia) y el
    // odometro que se muestra es la ultima lectura de la serie.
    if (gps.disponible && gps.odometro_km) {
      try { await this.lectura.registrarLecturaGps(id, gps.odometro_km, gps.ultimo_reporte); } catch (e) { console.error('[Flota] No se pudo guardar la lectura del GPS:', e?.message || e); }
    }
    const lecturas = await resumenLecturas(this.dbms, unidad);
    const snapshot = snaps.get(normPlate(unidad.plate)) || null;

    const km = lecturas.actual.KM;
    const odometro = km ? { km: km.valor, fuente: km.fuente, fecha: km.fecha } : (gps.disponible && gps.odometro_km ? { km: gps.odometro_km, fuente: 'GPS', fecha: gps.ultimo_reporte } : null);

    return {
      statusCode: STATUS_CODES.OK,
      data: {
        ...unidad, documentos, servicios, eventos, snapshot, gps_v3: gps, odometro, lecturas,
        encargado: actual ? { user_id: Number(actual.user_id), nombre: actual.display_name, desde: actual.assigned_at } : null,
        encargados_historial: encargados,
        frente: frentes.find((x) => !x.ended_at) || null,
        frentes_historial: frentes,
        conductor: conductorActual || null,
        conductores_historial: conductores,
        parada: paradaDe(movimientos.find((m) => m.plate_norm === normPlate(unidad.plate)), idleDays),
        puede_editar: puedeEditar,
        es_admin: isAdminCaller(caller_profile),
      },
    };
  };

  // Alta manual de una unidad (pedido de Lguerra, 05/10/2026): desde aqui se
  // administran todas; Combustible, Tracker y Control de Horas ya no crean.
  // Solo admin. Codigo obligatorio y unico; la placa no puede estar en otra
  // unidad (se compara sin guiones ni espacios). Queda en su historial.
  crearUnidad = async ({ code, plate, name, fleet_type, driver_name, tank_capacity_liters, caller_user, caller_profile }) => {
    assertAdmin(caller_profile, 'crear unidades');
    await this.dbmsReady;
    const codigo = String(code || '').trim().toUpperCase();
    if (!codigo) throw badRequest('Indica el código de la unidad (ej. FP-GT.03).');
    if (codigo.length > 40) throw badRequest('El código es demasiado largo.');
    const placa = String(plate || '').trim().toUpperCase() || null;
    const tipo = FLEET_TYPES.includes(fleet_type) ? fleet_type : null;
    if (!tipo) throw badRequest('Elige si la unidad es de Flota Liviana o Pesada.');

    const [mismoCodigo] = await this.query('fleetFindUnitByCode', { code: codigo });
    if (mismoCodigo) {
      throw new Error(JSON.stringify({
        message: mismoCodigo.deleted_at ? `El código ${codigo} perteneció a una unidad dada de baja; usa otro código.` : `Ya existe la unidad ${mismoCodigo.code}.`,
        statusCode: STATUS_CODES.CONFLICT, error: { existente_id: mismoCodigo.deleted_at ? null : Number(mismoCodigo.id) },
      }));
    }
    if (placa) {
      const [mismaPlaca] = await this.query('fleetFindUnitByPlate', { plate_norm: normPlate(placa) });
      if (mismaPlaca) throw new Error(JSON.stringify({ message: `La placa ${placa} ya está en la unidad ${mismaPlaca.code}.`, statusCode: STATUS_CODES.CONFLICT, error: { existente_id: Number(mismaPlaca.id) } }));
    }

    const [nueva] = await this.query('fleetCreateUnit', {
      code: codigo,
      name: clean(name, 'text') ?? null,
      plate: placa,
      driver_name: clean(driver_name, 'text') ?? 'ROTATIVO',
      fleet_type: tipo,
      tank_capacity_liters: numStr(clean(tank_capacity_liters, 'num') ?? null),
    });
    await this.query('fleetEnsureProfile', { unit_id: Number(nueva.id) });
    await this.query('fleetInsertEvent', { unit_id: Number(nueva.id), event_type: 'CREADO', title: 'Unidad creada a mano en Flota', detail: [placa && `Placa ${placa}`, tipo === 'PESADA' ? 'Flota Pesada' : 'Flota Liviana'].filter(Boolean).join(' · '), created_by: caller_user || null });
    return { statusCode: STATUS_CODES.CREATED, data: { id: Number(nueva.id), code: nueva.code }, message: `Unidad ${nueva.code} creada` };
  };

  guardar = async ({ id, caller_user, caller_profile, caller_user_id, ...campos }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    await this.dbmsReady;
    await assertUnitAccess(this.dbms, { caller_profile, caller_user_id, unit_id: id });
    if (campos.fleet_type !== undefined) assertAdmin(caller_profile, 'cambiar el tipo de flota');
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
      const fleetType = campos.fleet_type !== undefined ? (FLEET_TYPES.includes(campos.fleet_type) ? campos.fleet_type : null) : actual.fleet_type;
      await this.query('fleetUpdateUnitBasics', {
        id,
        driver_name: campos.driver_name !== undefined ? clean(campos.driver_name, 'text') : actual.driver_name,
        fleet_type: fleetType,
        name: campos.name !== undefined ? clean(campos.name, 'text') : actual.name,
        tank_capacity_liters: numStr(campos.tank_capacity_liters !== undefined ? clean(campos.tank_capacity_liters, 'num') : actual.tank_capacity_liters),
      });
      if (fleetType !== actual.fleet_type) await this.query('fleetSyncDriversOfUnit', { unit_id: Number(id) });
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
    const otros = Object.keys(patch).filter((k) => !['operational_status', 'status_cause', 'assigned_zone'].includes(k) && String(patch[k] ?? '') !== String(prev[k] ?? ''));
    if (otros.length || (cambiosUnidad && ['fleet_type', 'name', 'tank_capacity_liters'].some((k) => campos[k] !== undefined && String(campos[k] ?? '') !== String(actual[k] ?? '')))) {
      await this.evento(id, 'EDICION', 'Ficha actualizada', null, quien);
    }

    return this.obtener({ id, caller_profile, caller_user_id });
  };

  guardarDocumento = async ({ unit_id, doc_type, name, number, provider, issued_at, expires_at, notes, caller_user, caller_profile, caller_user_id }) => {
    if (!unit_id || !name || !doc_type) throw badRequest("Campos requeridos: 'unit_id', 'doc_type' y 'name'");
    await this.dbmsReady;
    await assertUnitAccess(this.dbms, { caller_profile, caller_user_id, unit_id });
    const [doc] = await this.query('fleetInsertDocument', {
      unit_id, doc_type, name: String(name).trim(),
      number: clean(number, 'text'), provider: clean(provider, 'text'),
      issued_at: clean(issued_at, 'date'), expires_at: clean(expires_at, 'date'), notes: clean(notes, 'text'),
    });
    const vence = clean(expires_at, 'date');
    await this.evento(unit_id, 'DOCUMENTO', `Documento agregado: ${name}`, vence ? `Vence: ${vence.split('-').reverse().join('/')}` : null, caller_user);
    return { statusCode: STATUS_CODES.CREATED, data: doc, message: 'Documento agregado' };
  };

  eliminarDocumento = async ({ id, caller_user, caller_profile, caller_user_id }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    const [previo] = await this.query('fleetGetDocument', { id });
    if (!previo) throw notFound(`Documento con id ${id} no encontrado`);
    await assertUnitAccess(this.dbms, { caller_profile, caller_user_id, unit_id: previo.unit_id });
    const [doc] = await this.query('fleetDeleteDocument', { id });
    if (!doc) throw notFound(`Documento con id ${id} no encontrado`);
    await this.evento(doc.unit_id, 'DOCUMENTO', `Documento eliminado: ${doc.name}`, null, caller_user);
    return { statusCode: STATUS_CODES.OK, message: 'Documento eliminado' };
  };

  registrarServicio = async ({ unit_id, service_at, service_type = 'PREVENTIVO', odometer_km, description, workshop, cost, caller_user, caller_profile, caller_user_id }) => {
    await this.dbmsReady;
    await assertUnitAccess(this.dbms, { caller_profile, caller_user_id, unit_id });
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

  eliminarServicio = async ({ id, caller_user, caller_profile, caller_user_id }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    const [previo] = await this.query('fleetGetService', { id });
    if (!previo) throw notFound(`Servicio con id ${id} no encontrado`);
    await assertUnitAccess(this.dbms, { caller_profile, caller_user_id, unit_id: previo.unit_id });
    const [svc] = await this.query('fleetDeleteService', { id });
    if (!svc) throw notFound(`Servicio con id ${id} no encontrado`);
    await this.evento(svc.unit_id, 'MANTENIMIENTO', `Servicio eliminado: ${svc.description}`, null, caller_user);
    return { statusCode: STATUS_CODES.OK, message: 'Servicio eliminado' };
  };

  agregarNota = async ({ unit_id, texto, caller_user, caller_profile, caller_user_id }) => {
    await this.dbmsReady;
    await assertUnitAccess(this.dbms, { caller_profile, caller_user_id, unit_id });
    const t = clean(texto, 'text');
    if (!unit_id || !t) throw badRequest("Campos requeridos: 'unit_id' y 'texto'");
    await this.evento(unit_id, 'NOTA', t.length > 190 ? `${t.slice(0, 187)}...` : t, t.length > 190 ? t : null, caller_user);
    return { statusCode: STATUS_CODES.CREATED, message: 'Nota agregada' };
  };

  // Frente / contrato / sitio donde esta asignada la unidad (058). Una sola
  // asignacion vigente: la nueva cierra la anterior en su fecha de inicio.
  // Frente vacio = quitar la asignacion. Admin o el encargado de esa unidad.
  asignarFrente = async ({ unit_id, frente, contrato, started_at, note, caller_user, caller_profile, caller_user_id }) => {
    if (!unit_id) throw badRequest("Campo requerido: 'unit_id'");
    await this.dbmsReady;
    await assertUnitAccess(this.dbms, { caller_profile, caller_user_id, unit_id });
    const fecha = clean(started_at, 'date') || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
    const nombre = clean(frente, 'text');
    const cerradas = await this.query('fleetCloseAssignment', { unit_id: Number(unit_id), ended_at: fecha });
    if (!nombre) {
      if (cerradas.length) await this.evento(Number(unit_id), 'UBICACION', 'Sin frente asignado', `Antes: ${cerradas[0].frente}`, caller_user);
      return { statusCode: STATUS_CODES.OK, message: 'Asignación quitada' };
    }
    if (nombre.length > 120) throw badRequest('El nombre del frente es demasiado largo.');
    await this.query('fleetInsertAssignment', { unit_id: Number(unit_id), frente: nombre, contrato: clean(contrato, 'text') ?? null, started_at: fecha, note: clean(note, 'text') ?? null, created_by: caller_user || null });
    await this.evento(Number(unit_id), 'UBICACION', `Frente: ${nombre}`, [clean(contrato, 'text') && `Contrato ${clean(contrato, 'text')}`, cerradas.length && `Antes: ${cerradas[0].frente}`].filter(Boolean).join(' · ') || null, caller_user);
    return { statusCode: STATUS_CODES.CREATED, message: `Unidad asignada a ${nombre}` };
  };

  // Frentes ya usados, para sugerirlos al escribir (y contar unidades).
  listarFrentes = async () => ({ statusCode: STATUS_CODES.OK, data: await this.query('fleetFrentesUsados') });

  // Lectura diaria del odometro del GPS de TODA la flota (pedido de Lguerra,
  // 07/10/2026): antes solo se guardaba al abrir la ficha. La corre el cron
  // FLEET_GPS_ODOMETER_CRON (scheduler.js). La API v3 corta tras ~10
  // consultas seguidas: una placa cada 7 s y, si corta, espera 1 min y sigue.
  // Una sola lectura por unidad y por dia (registrarLecturaGps lo controla).
  sincronizarOdometrosGps = async ({ pausaMs = 7000 } = {}) => {
    const unidades = await this.query('fleetUnitsWithPlate');
    const r = { total: unidades.length, guardadas: 0, sin_dato: 0, errores: 0 };
    for (const u of unidades) {
      for (let intento = 0; intento < 2; intento += 1) {
        try {
          const estado = await this.gps.getEstadoActualV3(u.plate);
          const km = Number(estado?.Odometer) || null;
          if (km) {
            const antes = (await this.query('fleetListReadings', { unit_id: Number(u.id) })).length;
            await this.lectura.registrarLecturaGps(u.id, km, estado.LastReported || estado.LastTime || null);
            const despues = (await this.query('fleetListReadings', { unit_id: Number(u.id) })).length;
            if (despues > antes) r.guardadas += 1;
          } else r.sin_dato += 1;
          break;
        } catch (error) {
          if (error?.isRateLimit && intento === 0) { await sleep(60000); continue; }
          r.errores += 1;
          console.error(`[Flota] Odómetro del GPS de ${u.code}:`, error?.message || error);
          break;
        }
      }
      await sleep(pausaMs);
    }
    return r;
  };

  getAjustes = async () => {
    const rows = await this.query('fleetGetSettings');
    return { statusCode: STATUS_CODES.OK, data: Object.fromEntries(rows.map((r) => [r.key, Number(r.value)])) };
  };

  guardarAjustes = async (params) => {
    assertAdmin(params?.caller_profile, 'cambiar los intervalos de mantenimiento');
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
