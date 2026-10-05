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
    { sub_system: 'Tracker', class_name: 'Suscriptor', method_name: 'listar' },
    { sub_system: 'Tracker', class_name: 'Suscriptor', method_name: 'aprobar' },
    { sub_system: 'Tracker', class_name: 'Suscriptor', method_name: 'quitarAcceso' },
  ],
  '/tracker/map': [
    { sub_system: 'Tracker', class_name: 'Snapshot', method_name: 'getLatestSnapshots' },
    { sub_system: 'Tracker', class_name: 'Snapshot', method_name: 'syncNow' },
    { sub_system: 'Tracker', class_name: 'Recorrido', method_name: 'listar' },
    { sub_system: 'Tracker', class_name: 'Recorrido', method_name: 'ruta' },
  ],
  '/tracker/report': [
    { sub_system: 'Tracker', class_name: 'Reporte', method_name: 'generarReporte' },
    { sub_system: 'Tracker', class_name: 'Archivo', method_name: 'archivarAhora' },
    { sub_system: 'Tracker', class_name: 'Comportamiento', method_name: 'getAnalisisDelDia' },
    { sub_system: 'Tracker', class_name: 'Comportamiento', method_name: 'getAnalisisGuardado' },
    { sub_system: 'Tracker', class_name: 'Notificador', method_name: 'notificarCierreDeTurno' },
    { sub_system: 'Tracker', class_name: 'Notificador', method_name: 'verificarAnexoSeguridad' },
  ],
  // Reportes se dividió en dos páginas (05/10/2026), cada una con su permiso.
  '/reports/fuel': [
    { sub_system: 'Fuel', class_name: 'Reporte', method_name: 'getFuelSummary' },
  ],
  // getAllEmpresas / getProyectosByEmpresa: los usa el "Detalle de un Día"
  // para elegir empresa y proyecto (antes faltaban y un perfil no-admin veía
  // esos selectores vacíos).
  '/reports/hours': [
    { sub_system: 'Horas', class_name: 'Reporte', method_name: 'getResumenHoras' },
    { sub_system: 'Horas', class_name: 'Reporte', method_name: 'getResumenPorDia' },
    { sub_system: 'Horas', class_name: 'Empresa', method_name: 'getAllEmpresas' },
    { sub_system: 'Horas', class_name: 'Proyecto', method_name: 'getAllProyectos' },
    { sub_system: 'Horas', class_name: 'Proyecto', method_name: 'getProyectosByEmpresa' },
    { sub_system: 'Horas', class_name: 'Proyecto', method_name: 'getEquiposAsignados' },
    { sub_system: 'Horas', class_name: 'Registro', method_name: 'getRegistrosDelDia' },
  ],
  // Flota (05/10/2026): faltaban -- un perfil con la sección asignada veía
  // "Flota" en el menú pero la lista salía vacía porque el dispatcher le
  // negaba listarFichas. Mismas funciones que encargado_flota en
  // permission.csv; modificar sigue limitado a las unidades de las que el
  // usuario es encargado (assertUnitAccess en fleetAccess.js), en las demás
  // queda en solo lectura.
  '/fleet': [
    { sub_system: 'Flota', class_name: 'Ficha', method_name: 'listarFichas' },
    { sub_system: 'Flota', class_name: 'Ficha', method_name: 'obtener' },
    { sub_system: 'Flota', class_name: 'Ficha', method_name: 'getAjustes' },
    { sub_system: 'Flota', class_name: 'Ficha', method_name: 'guardar' },
    { sub_system: 'Flota', class_name: 'Ficha', method_name: 'guardarDocumento' },
    { sub_system: 'Flota', class_name: 'Ficha', method_name: 'eliminarDocumento' },
    { sub_system: 'Flota', class_name: 'Ficha', method_name: 'agregarNota' },
    { sub_system: 'Flota', class_name: 'Catalogo', method_name: 'listarCatalogo' },
    { sub_system: 'Flota', class_name: 'Lectura', method_name: 'registrarLectura' },
    { sub_system: 'Flota', class_name: 'Lectura', method_name: 'reemplazarMedidor' },
  ],
  '/fleet/catalog': [
    { sub_system: 'Flota', class_name: 'Catalogo', method_name: 'listarCatalogo' },
    { sub_system: 'Flota', class_name: 'Catalogo', method_name: 'asignarUnidades' },
    { sub_system: 'Flota', class_name: 'Catalogo', method_name: 'quitarUnidad' },
    { sub_system: 'Flota', class_name: 'Catalogo', method_name: 'proponerModelo' },
  ],
  '/hours': [
    { sub_system: 'Horas', class_name: 'Proyecto', method_name: 'getProyectosByEmpresa' },
    { sub_system: 'Horas', class_name: 'Proyecto', method_name: 'getEquiposAsignados' },
    { sub_system: 'Horas', class_name: 'Empresa', method_name: 'getAllEmpresas' },
    { sub_system: 'Horas', class_name: 'Registro', method_name: 'guardarRegistro' },
    { sub_system: 'Horas', class_name: 'Registro', method_name: 'getRegistrosDelDia' },
    { sub_system: 'Horas', class_name: 'Registro', method_name: 'eliminarRegistro' },
    { sub_system: 'Horas', class_name: 'Registro', method_name: 'getAcumuladoMes' },
  ],
  '/hours/companies': [
    { sub_system: 'Horas', class_name: 'Empresa', method_name: 'createEmpresa' },
    { sub_system: 'Horas', class_name: 'Empresa', method_name: 'getEmpresaById' },
    { sub_system: 'Horas', class_name: 'Empresa', method_name: 'getAllEmpresas' },
    { sub_system: 'Horas', class_name: 'Empresa', method_name: 'updateEmpresa' },
    { sub_system: 'Horas', class_name: 'Empresa', method_name: 'deleteEmpresa' },
  ],
  // Solo lectura a propósito: create/update/delete/asignarPerfil/
  // quitarPerfil/getPerfilesAsignados y la gestión de Equipo quedaron
  // fuera de esta lista porque Julio pidió que un perfil nuevo (no-admin)
  // con acceso a Proyectos solo pueda VER sus proyectos, nunca editarlos,
  // eliminarlos ni tocar quién tiene acceso a ellos -- eso sigue siendo
  // solo de admin (que no depende de esta lista, ya tiene su propio
  // acceso directo vía permission.csv). Si algún día hace falta un perfil
  // "gestor de proyectos" con más permisos, se vuelve a evaluar entonces.
  '/hours/projects': [
    { sub_system: 'Horas', class_name: 'Proyecto', method_name: 'getProyectoById' },
    { sub_system: 'Horas', class_name: 'Proyecto', method_name: 'getAllProyectos' },
    { sub_system: 'Horas', class_name: 'Proyecto', method_name: 'getProyectosByEmpresa' },
    { sub_system: 'Horas', class_name: 'Empresa', method_name: 'getAllEmpresas' },
  ],
  '/hours/equipment': [
    { sub_system: 'Horas', class_name: 'Equipo', method_name: 'createEquipo' },
    { sub_system: 'Horas', class_name: 'Equipo', method_name: 'getEquipoById' },
    { sub_system: 'Horas', class_name: 'Equipo', method_name: 'getAllEquipos' },
    { sub_system: 'Horas', class_name: 'Equipo', method_name: 'updateEquipo' },
    { sub_system: 'Horas', class_name: 'Equipo', method_name: 'deleteEquipo' },
  ],
};

/**
 * Al arrancar el backend: a cada perfil le agrega las funciones que le faltan
 * según las secciones que tiene asignadas (SECTION_PERMISSIONS). Así, si una
 * pantalla empieza a usar una función nueva, los perfiles que ya tenían esa
 * sección la reciben solos, sin quitarles y volverles a poner la sección.
 * Solo SUMA: no quita funciones, porque algunos perfiles tienen permisos que
 * vienen directo de permission.csv (ej. encargado_flota). Solo vincula
 * funciones que ya existen (no crea transacciones) y es seguro correrlo en
 * varios procesos a la vez (ON CONFLICT DO NOTHING). Devuelve cuántos
 * permisos agregó.
 */
export async function resyncSectionPermissions(dbms) {
  const rows = (await dbms.executeNamedQuery({ nameQuery: 'getOptionProfileNames', params: {} }))?.rows || [];
  let added = 0;
  for (const { option_name, profile_name } of rows) {
    for (const perm of SECTION_PERMISSIONS[option_name] || []) {
      const res = await dbms.executeNamedQuery({
        nameQuery: 'linkExistingMethodToProfile',
        params: { method_name: perm.method_name, profile_name },
      });
      added += res?.rows?.length || 0;
    }
  }
  return added;
}

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
