import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import { assertAdmin } from './fleetAccess.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Encargados de unidad (048_fleet_unit_manager.sql): un admin asigna a cada
// unidad un usuario con perfil encargado_flota, que despues completa la
// ficha de SUS unidades. Nombres de metodo unicos a proposito (los permisos
// se guardan por nombre de metodo, sin la clase).
const badRequest = (message) => new Error(JSON.stringify({ message, statusCode: STATUS_CODES.BAD_REQUEST }));

class Encargado {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  query = async (nameQuery, params = {}) => {
    await this.dbmsReady;
    const result = await this.dbms.executeNamedQuery({ nameQuery, params });
    return result?.rows || [];
  };

  evento = (unit_id, title, created_by) =>
    this.query('fleetInsertEvent', { unit_id, event_type: 'CONDUCTOR', title, detail: null, created_by: created_by || null });

  /** Usuarios con perfil encargado_flota y cuantas unidades tiene cada uno. */
  listarEncargados = async ({ caller_profile } = {}) => {
    assertAdmin(caller_profile, 'ver los encargados');
    return { statusCode: STATUS_CODES.OK, data: await this.query('fleetListManagerUsers') };
  };

  asignarEncargado = async ({ unit_ids, user_id, caller_profile, caller_user }) => {
    assertAdmin(caller_profile, 'asignar encargados');
    const ids = (Array.isArray(unit_ids) ? unit_ids : [unit_ids]).map(Number).filter(Number.isInteger);
    const userId = Number(user_id);
    if (!ids.length || !Number.isInteger(userId)) throw badRequest("Campos requeridos: 'unit_ids' y 'user_id'");
    const [ok] = await this.query('fleetIsManagerUser', { user_id: userId });
    if (!ok) throw badRequest('Ese usuario no tiene el perfil "encargado_flota". Asígnaselo en Seguridad → Usuarios.');
    const [usuario] = (await this.query('fleetListManagerUsers')).filter((u) => Number(u.id) === userId);

    for (const unitId of ids) {
      const [anterior] = await this.query('fleetEndManager', { unit_id: unitId, ended_by: caller_user || null });
      if (anterior && Number(anterior.user_id) === userId) {
        // Ya era el encargado: se deja como estaba (se reabre sin duplicar historial).
        await this.query('fleetInsertManager', { unit_id: unitId, user_id: userId, assigned_by: caller_user || null });
        continue;
      }
      await this.query('fleetInsertManager', { unit_id: unitId, user_id: userId, assigned_by: caller_user || null });
      await this.evento(unitId, `Encargado asignado: ${usuario?.display_name || usuario?.username || `usuario ${userId}`}`, caller_user);
    }
    return { statusCode: STATUS_CODES.OK, message: `Encargado asignado a ${ids.length} unidad${ids.length === 1 ? '' : 'es'}` };
  };

  quitarEncargado = async ({ unit_id, caller_profile, caller_user }) => {
    assertAdmin(caller_profile, 'quitar encargados');
    if (!unit_id) throw badRequest("Campo requerido: 'unit_id'");
    const [anterior] = await this.query('fleetEndManager', { unit_id: Number(unit_id), ended_by: caller_user || null });
    if (anterior) await this.evento(Number(unit_id), 'Encargado retirado de la unidad', caller_user);
    return { statusCode: STATUS_CODES.OK, message: 'Encargado quitado' };
  };
}

export default Encargado;
