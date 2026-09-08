import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import Security from '../../../security/security.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

/**
 * Qué transacciones (subsistema+clase+método) desbloquea cada sección.
 * "Puede ver la sección" (option_profile) por sí solo no autoriza nada en el
 * dispatcher — la autorización real es method_profile. Sin este mapeo,
 * asignarle una sección a un perfil solo cambiaría el menú, sin permitirle
 * usarla de verdad.
 */
const SECTION_PERMISSIONS = {
  '/security/persons': [
    { sub_system: 'Security', class_name: 'Person', method_name: 'createPerson' },
    { sub_system: 'Security', class_name: 'Person', method_name: 'getAllPersons' },
    { sub_system: 'Security', class_name: 'Person', method_name: 'getPersonById' },
    { sub_system: 'Security', class_name: 'Person', method_name: 'updatePerson' },
    { sub_system: 'Security', class_name: 'Person', method_name: 'deletePerson' },
  ],
  '/security/users': [
    { sub_system: 'Users', class_name: 'Usuario', method_name: 'createUsuario' },
    { sub_system: 'Users', class_name: 'Usuario', method_name: 'getUsuarioById' },
    { sub_system: 'Users', class_name: 'Usuario', method_name: 'getUsuarioByEmail' },
    { sub_system: 'Users', class_name: 'Usuario', method_name: 'getAllUsuarios' },
    { sub_system: 'Users', class_name: 'Usuario', method_name: 'updateUsuario' },
    { sub_system: 'Users', class_name: 'Usuario', method_name: 'deleteUsuario' },
  ],
  '/security/profiles': [
    { sub_system: 'Security', class_name: 'Profile', method_name: 'createProfile' },
    { sub_system: 'Security', class_name: 'Profile', method_name: 'assignProfileToUser' },
    { sub_system: 'Security', class_name: 'Profile', method_name: 'getProfileByName' },
    { sub_system: 'Security', class_name: 'Profile', method_name: 'getAllProfiles' },
    { sub_system: 'Security', class_name: 'Profile', method_name: 'getProfileById' },
    { sub_system: 'Security', class_name: 'Profile', method_name: 'updateProfile' },
    { sub_system: 'Security', class_name: 'Profile', method_name: 'deleteProfile' },
    { sub_system: 'Security', class_name: 'Profile', method_name: 'removeProfileFromUser' },
    { sub_system: 'Security', class_name: 'Profile', method_name: 'getProfilesByUser' },
    { sub_system: 'Security', class_name: 'Option', method_name: 'getAllOptions' },
    { sub_system: 'Security', class_name: 'Option', method_name: 'getOptionsByProfile' },
    { sub_system: 'Security', class_name: 'Option', method_name: 'assignOptionToProfile' },
    { sub_system: 'Security', class_name: 'Option', method_name: 'removeOptionFromProfile' },
  ],
  '/fuel': [
    { sub_system: 'Fuel', class_name: 'Vehiculo', method_name: 'createVehiculo' },
    { sub_system: 'Fuel', class_name: 'Vehiculo', method_name: 'getVehiculoById' },
    { sub_system: 'Fuel', class_name: 'Vehiculo', method_name: 'getAllVehiculos' },
    { sub_system: 'Fuel', class_name: 'Vehiculo', method_name: 'updateVehiculo' },
    { sub_system: 'Fuel', class_name: 'Vehiculo', method_name: 'deleteVehiculo' },
    { sub_system: 'Fuel', class_name: 'Carga', method_name: 'createCarga' },
    { sub_system: 'Fuel', class_name: 'Carga', method_name: 'getCargaById' },
    { sub_system: 'Fuel', class_name: 'Carga', method_name: 'getCargasByVehiculo' },
    { sub_system: 'Fuel', class_name: 'Carga', method_name: 'getAllCargas' },
    { sub_system: 'Fuel', class_name: 'Carga', method_name: 'updateCarga' },
    { sub_system: 'Fuel', class_name: 'Carga', method_name: 'deleteCarga' },
  ],
  '/fuel/heavy': [
    { sub_system: 'Fuel', class_name: 'Pesada', method_name: 'createPesada' },
    { sub_system: 'Fuel', class_name: 'Pesada', method_name: 'getPesadaById' },
    { sub_system: 'Fuel', class_name: 'Pesada', method_name: 'getAllPesada' },
    { sub_system: 'Fuel', class_name: 'Pesada', method_name: 'updatePesada' },
    { sub_system: 'Fuel', class_name: 'Pesada', method_name: 'deletePesada' },
  ],
  '/fuel/tank': [
    { sub_system: 'Fuel', class_name: 'Tanque', method_name: 'createTank' },
    { sub_system: 'Fuel', class_name: 'Tanque', method_name: 'getAllTanks' },
    { sub_system: 'Fuel', class_name: 'Tanque', method_name: 'getTankById' },
    { sub_system: 'Fuel', class_name: 'Tanque', method_name: 'updateTank' },
    { sub_system: 'Fuel', class_name: 'Tanque', method_name: 'deleteTank' },
    { sub_system: 'Fuel', class_name: 'Tanque', method_name: 'getMovementsByTank' },
    { sub_system: 'Fuel', class_name: 'Tanque', method_name: 'registerMovement' },
  ],
  '/fuel/vehicles': [
    { sub_system: 'Fuel', class_name: 'Vehiculo', method_name: 'createVehiculo' },
    { sub_system: 'Fuel', class_name: 'Vehiculo', method_name: 'getVehiculoById' },
    { sub_system: 'Fuel', class_name: 'Vehiculo', method_name: 'getAllVehiculos' },
    { sub_system: 'Fuel', class_name: 'Vehiculo', method_name: 'updateVehiculo' },
    { sub_system: 'Fuel', class_name: 'Vehiculo', method_name: 'deleteVehiculo' },
  ],
  '/tracker': [
    { sub_system: 'Tracker', class_name: 'Unidad', method_name: 'createUnidad' },
    { sub_system: 'Tracker', class_name: 'Unidad', method_name: 'getAllUnidades' },
    { sub_system: 'Tracker', class_name: 'Unidad', method_name: 'getUnidadById' },
    { sub_system: 'Tracker', class_name: 'Unidad', method_name: 'updateUnidad' },
    { sub_system: 'Tracker', class_name: 'Unidad', method_name: 'deleteUnidad' },
    { sub_system: 'Tracker', class_name: 'Snapshot', method_name: 'getLatestSnapshots' },
    { sub_system: 'Tracker', class_name: 'Snapshot', method_name: 'syncNow' },
    { sub_system: 'Tracker', class_name: 'Alerta', method_name: 'getRecentAlerts' },
  ],
  '/tracker/alerts': [
    { sub_system: 'Tracker', class_name: 'Alerta', method_name: 'getRecentAlerts' },
  ],
  '/tracker/map': [
    { sub_system: 'Tracker', class_name: 'Snapshot', method_name: 'getLatestSnapshots' },
    { sub_system: 'Tracker', class_name: 'Snapshot', method_name: 'syncNow' },
  ],
  '/tracker/report': [
    { sub_system: 'Tracker', class_name: 'Reporte', method_name: 'generarReporte' },
    { sub_system: 'Tracker', class_name: 'Archivo', method_name: 'archivarAhora' },
    { sub_system: 'Tracker', class_name: 'Comportamiento', method_name: 'getAnalisisDelDia' },
    { sub_system: 'Tracker', class_name: 'Notificador', method_name: 'notificarCierreDeTurno' },
    { sub_system: 'Tracker', class_name: 'Notificador', method_name: 'verificarAnexoSeguridad' },
  ],
  // Reportes es 100% datos mock en el frontend hoy — sin BO que autorizar.
  '/reports': [],
};

export class Option {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
    this.security = new Security();
  }

  getAllOptions = async () => {
    await this.dbmsReady;
    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getAllOptions',
      params: {},
    });
    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  getOptionsByProfile = async ({ profile_id }) => {
    await this.dbmsReady;

    if (!profile_id) {
      throw new Error(JSON.stringify({ message: "Campo requerido: 'profile_id'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getOptionsByProfileId',
      params: { profile_id },
    });

    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  assignOptionToProfile = async ({ option_id, profile_id }) => {
    await this.dbmsReady;

    if (!option_id || !profile_id) {
      throw new Error(JSON.stringify({ message: "Campos requeridos: 'option_id', 'profile_id'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'insertOptionProfile',
      params: { profile_id, option_id },
    });

    await this.grantSectionMethods(option_id, profile_id);

    return { statusCode: STATUS_CODES.CREATED, data: result?.rows?.[0] || null, message: 'Sección asignada' };
  };

  removeOptionFromProfile = async ({ option_id, profile_id }) => {
    await this.dbmsReady;

    if (!option_id || !profile_id) {
      throw new Error(JSON.stringify({ message: "Campos requeridos: 'option_id', 'profile_id'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }

    await this.dbms.executeNamedQuery({
      nameQuery: 'deleteOptionProfileByIds',
      params: { profile_id, option_id },
    });

    await this.revokeSectionMethods(option_id, profile_id);

    return { statusCode: STATUS_CODES.OK, message: 'Sección removida del perfil' };
  };

  // ---------- Otorgar/revocar permisos de método asociados a la sección ----------

  getSectionMethods = async (option_id) => {
    const option = (
      await this.dbms.executeNamedQuery({ nameQuery: 'getOptionById', params: { id: option_id } })
    )?.rows?.[0];
    return SECTION_PERMISSIONS[option?.name] || [];
  };

  getProfileName = async (profile_id) => {
    const profile = (
      await this.dbms.executeNamedQuery({ nameQuery: 'getProfileById', params: { id: profile_id } })
    )?.rows?.[0];
    return profile?.name || null;
  };

  grantSectionMethods = async (option_id, profile_id) => {
    const methods = await this.getSectionMethods(option_id);
    if (!methods.length) return;
    const profileName = await this.getProfileName(profile_id);
    if (!profileName) return;

    for (const perm of methods) {
      await this.security.setPermission({ ...perm, profile_name: profileName });
    }
  };

  revokeSectionMethods = async (option_id, profile_id) => {
    const methods = await this.getSectionMethods(option_id);
    if (!methods.length) return;
    const profileName = await this.getProfileName(profile_id);
    if (!profileName) return;

    for (const perm of methods) {
      await this.dbms.executeNamedQuery({
        nameQuery: 'delProfileMethod',
        params: { method_name: perm.method_name, profile_name: profileName },
      });
    }
    // setPermission solo agrega al mapa en memoria; para que las revocaciones
    // también se reflejen ahí, se refresca completo desde la BD.
    await this.security.syncPermissions();
  };
}

export default Option;
