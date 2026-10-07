import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import { assertUnitAccess, assertAdmin } from './fleetAccess.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Conductores de la flota (058_fleet_frente_conductores.sql, pedido de
// Lguerra 07/10/2026): registro con cedula, telefono, licencia y su
// vencimiento, y que unidad maneja cada uno (con historial). Al asignar se
// sigue llenando fleet_unit.driver_name, que usan el Tracker y los reportes.
// Nombres de metodo unicos a proposito (los permisos van por nombre).

const badRequest = (message) => new Error(JSON.stringify({ message, statusCode: STATUS_CODES.BAD_REQUEST }));
const notFound = (message) => new Error(JSON.stringify({ message, statusCode: STATUS_CODES.NOT_FOUND }));
const txt = (v) => (v == null ? null : String(v).trim() || null);
const FLOTAS = ['LIVIANA', 'PESADA', 'AMBAS'];
const fecha = (v) => (v && /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : null);

class Conductor {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  query = async (nameQuery, params = {}) => {
    await this.dbmsReady;
    const result = await this.dbms.executeNamedQuery({ nameQuery, params });
    return result?.rows || [];
  };

  evento = (unit_id, title, detail, created_by) =>
    this.query('fleetInsertEvent', { unit_id: Number(unit_id), event_type: 'CONDUCTOR', title, detail: detail || null, created_by: created_by || null });

  listarConductores = async () => ({ statusCode: STATUS_CODES.OK, data: await this.query('fleetListDrivers') });

  // Ficha del conductor (07/10/2026): sus datos + todas las unidades que ha
  // manejado (vigentes primero).
  obtenerConductor = async ({ id }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    const conductor = (await this.query('fleetListDrivers')).find((d) => Number(d.id) === Number(id));
    if (!conductor) throw notFound('Ese conductor no existe o fue dado de baja.');
    const historial = await this.query('fleetDriverUnitHistory', { driver_id: Number(id) });
    return { statusCode: STATUS_CODES.OK, data: { ...conductor, historial } };
  };

  // Crear (sin id) o editar (con id). Solo admin.
  guardarConductor = async ({ id, full_name, cedula, phone, license_number, license_category, license_expires_at, medical_expires_at, fleet_type, policy_signed_at, heavy_cert_expires_at, notes, is_active, caller_user, caller_profile }) => {
    assertAdmin(caller_profile, 'registrar conductores');
    const nombre = txt(full_name);
    if (!nombre) throw badRequest('Indica el nombre del conductor.');
    const ced = txt(cedula)?.toUpperCase() || null;
    if (ced) {
      const [otro] = await this.query('fleetFindDriverByCedula', { cedula: ced, id: Number(id) || 0 });
      if (otro) throw new Error(JSON.stringify({ message: `La cédula ${ced} ya es de ${otro.full_name}.`, statusCode: STATUS_CODES.CONFLICT, error: { existente_id: Number(otro.id) } }));
    }
    const datos = {
      full_name: nombre, cedula: ced, phone: txt(phone), license_number: txt(license_number)?.toUpperCase() || null,
      license_category: txt(license_category)?.toUpperCase() || null, license_expires_at: fecha(license_expires_at), medical_expires_at: fecha(medical_expires_at), notes: txt(notes),
      fleet_type: FLOTAS.includes(fleet_type) ? fleet_type : null,
      policy_signed_at: fecha(policy_signed_at), heavy_cert_expires_at: fecha(heavy_cert_expires_at),
      is_active: is_active === undefined ? true : is_active === true || is_active === 'true',
    };
    if (id) {
      const [ok] = await this.query('fleetUpdateDriver', { id: Number(id), ...datos });
      if (!ok) throw notFound(`Conductor con id ${id} no encontrado`);
      // Si ya maneja unidades, manda la flota de esas unidades.
      await this.query('fleetSyncDriverFleet', { driver_id: Number(id) });
      return { statusCode: STATUS_CODES.OK, data: { id: Number(id) }, message: 'Conductor actualizado' };
    }
    const [nuevo] = await this.query('fleetInsertDriver', { ...datos, created_by: caller_user || null });
    return { statusCode: STATUS_CODES.CREATED, data: { id: Number(nuevo.id) }, message: 'Conductor registrado' };
  };

  // Baja (no se borra: queda en el historial de las unidades que manejo).
  eliminarConductor = async ({ id, caller_user, caller_profile }) => {
    assertAdmin(caller_profile, 'dar de baja conductores');
    if (!id) throw badRequest("Campo requerido: 'id'");
    const unidades = await this.query('fleetCloseDriverUnits', { driver_id: Number(id) });
    const [baja] = await this.query('fleetDeleteDriver', { id: Number(id) });
    if (!baja) throw notFound(`Conductor con id ${id} no encontrado`);
    for (const u of unidades) {
      await this.query('fleetSetUnitDriverName', { unit_id: Number(u.unit_id), driver_name: 'ROTATIVO' });
      await this.evento(u.unit_id, 'Conductor: ROTATIVO', `${baja.full_name} fue dado de baja`, caller_user);
    }
    return { statusCode: STATUS_CODES.OK, message: `${baja.full_name} dado de baja` };
  };

  // Que conductor maneja la unidad. driver_id vacio = ROTATIVO (sin fijo).
  // Un conductor puede tener varias unidades. Admin o el encargado de la unidad.
  asignarConductor = async ({ unit_id, driver_id, caller_user, caller_profile, caller_user_id }) => {
    if (!unit_id) throw badRequest("Campo requerido: 'unit_id'");
    await this.dbmsReady;
    await assertUnitAccess(this.dbms, { caller_profile, caller_user_id, unit_id });
    let conductor = null;
    if (driver_id) {
      [conductor] = await this.query('fleetGetDriver', { id: Number(driver_id) });
      if (!conductor || conductor.deleted_at) throw notFound('Ese conductor no existe o fue dado de baja.');
    }
    const anteriores = await this.query('fleetCloseUnitDriver', { unit_id: Number(unit_id) });
    if (conductor) await this.query('fleetInsertUnitDriver', { unit_id: Number(unit_id), driver_id: Number(conductor.id), created_by: caller_user || null });
    // La flota del conductor (y la del que manejaba antes) se sincroniza con
    // sus unidades, se asigne desde la ficha de la unidad o la del conductor.
    const tocados = new Set([...anteriores.map((a) => Number(a.driver_id)), ...(conductor ? [Number(conductor.id)] : [])]);
    for (const driver_id of tocados) await this.query('fleetSyncDriverFleet', { driver_id });
    const nombre = conductor ? conductor.full_name.toUpperCase() : 'ROTATIVO';
    await this.query('fleetSetUnitDriverName', { unit_id: Number(unit_id), driver_name: nombre });
    await this.evento(unit_id, `Conductor: ${nombre}`, conductor?.cedula ? `C.I. ${conductor.cedula}` : null, caller_user);
    return { statusCode: STATUS_CODES.OK, message: `Conductor asignado: ${nombre}` };
  };
}

export default Conductor;
