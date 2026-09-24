import { executeTransaction } from "./api";

// Ids reales verificados contra la BD tras reiniciar el backend
// (ver ROADMAP_HORAS_RENTABILIDAD.md / plan "Control de Horas").
const TX = {
  CREATE_EMPRESA: 132,
  GET_EMPRESA_BY_ID: 133,
  GET_ALL_EMPRESAS: 134,
  UPDATE_EMPRESA: 135,
  DELETE_EMPRESA: 136,
  CREATE_PROYECTO: 137,
  GET_PROYECTO_BY_ID: 138,
  GET_ALL_PROYECTOS: 139,
  UPDATE_PROYECTO: 140,
  DELETE_PROYECTO: 141,
  GET_PROYECTOS_BY_EMPRESA: 142,
  GET_EQUIPOS_ASIGNADOS: 143,
  CREATE_EQUIPO: 144,
  GET_EQUIPO_BY_ID: 145,
  GET_ALL_EQUIPOS: 146,
  UPDATE_EQUIPO: 147,
  DELETE_EQUIPO: 148,
  ASIGNAR_EQUIPO: 149,
  GUARDAR_REGISTRO: 150,
  GET_REGISTROS_DEL_DIA: 151,
  ELIMINAR_REGISTRO: 152,
  ASIGNAR_PERFIL_PROYECTO: 153,
  QUITAR_PERFIL_PROYECTO: 154,
  GET_PERFILES_ASIGNADOS: 155,
  GET_ACUMULADO_MES: 156,
  QUITAR_ASIGNACION_EQUIPO: 157,
  GET_RESUMEN_HORAS: 158,
  GET_RESUMEN_POR_DIA: 159,
};

const unwrap = (res) => {
  const d = res?.data;
  if (d?.data?.data !== undefined) return d.data.data;
  if (Array.isArray(d?.data)) return d.data;
  return d;
};

const hoursService = {
  // Empresa
  createEmpresa(data) { return executeTransaction(TX.CREATE_EMPRESA, data).then(unwrap); },
  getEmpresaById(id) { return executeTransaction(TX.GET_EMPRESA_BY_ID, { id }).then(unwrap); },
  getAllEmpresas() { return executeTransaction(TX.GET_ALL_EMPRESAS, {}).then(unwrap); },
  updateEmpresa(id, data) { return executeTransaction(TX.UPDATE_EMPRESA, { id, ...data }).then(unwrap); },
  deleteEmpresa(id) { return executeTransaction(TX.DELETE_EMPRESA, { id }).then(unwrap); },

  // Proyecto
  createProyecto(data) { return executeTransaction(TX.CREATE_PROYECTO, data).then(unwrap); },
  getProyectoById(id) { return executeTransaction(TX.GET_PROYECTO_BY_ID, { id }).then(unwrap); },
  getAllProyectos() { return executeTransaction(TX.GET_ALL_PROYECTOS, {}).then(unwrap); },
  updateProyecto(id, data) { return executeTransaction(TX.UPDATE_PROYECTO, { id, ...data }).then(unwrap); },
  deleteProyecto(id) { return executeTransaction(TX.DELETE_PROYECTO, { id }).then(unwrap); },
  getProyectosByEmpresa(company_id) { return executeTransaction(TX.GET_PROYECTOS_BY_EMPRESA, { company_id }).then(unwrap); },
  getEquiposAsignados({ project_id, fecha }) { return executeTransaction(TX.GET_EQUIPOS_ASIGNADOS, { project_id, fecha }).then(unwrap); },
  asignarPerfilProyecto({ project_id, profile_name }) {
    return executeTransaction(TX.ASIGNAR_PERFIL_PROYECTO, { project_id, profile_name }).then(unwrap);
  },
  quitarPerfilProyecto({ project_id, profile_name }) {
    return executeTransaction(TX.QUITAR_PERFIL_PROYECTO, { project_id, profile_name }).then(unwrap);
  },
  getPerfilesAsignados(project_id) {
    return executeTransaction(TX.GET_PERFILES_ASIGNADOS, { project_id }).then(unwrap);
  },

  // Equipo
  createEquipo(data) { return executeTransaction(TX.CREATE_EQUIPO, data).then(unwrap); },
  getEquipoById(id) { return executeTransaction(TX.GET_EQUIPO_BY_ID, { id }).then(unwrap); },
  getAllEquipos() { return executeTransaction(TX.GET_ALL_EQUIPOS, {}).then(unwrap); },
  updateEquipo(id, data) { return executeTransaction(TX.UPDATE_EQUIPO, { id, ...data }).then(unwrap); },
  deleteEquipo(id) { return executeTransaction(TX.DELETE_EQUIPO, { id }).then(unwrap); },
  asignarEquipo({ equipo_id, project_id, assigned_from }) {
    return executeTransaction(TX.ASIGNAR_EQUIPO, { equipo_id, project_id, assigned_from }).then(unwrap);
  },
  quitarAsignacionEquipo({ equipo_id, effective_from }) {
    return executeTransaction(TX.QUITAR_ASIGNACION_EQUIPO, { equipo_id, effective_from }).then(unwrap);
  },

  // Reportes
  getResumenHoras({ from, to }) {
    return executeTransaction(TX.GET_RESUMEN_HORAS, { from, to }).then(unwrap);
  },
  getResumenPorDia({ from, to }) {
    return executeTransaction(TX.GET_RESUMEN_POR_DIA, { from, to }).then(unwrap);
  },

  // Registro diario
  guardarRegistro(data) { return executeTransaction(TX.GUARDAR_REGISTRO, data).then(unwrap); },
  getRegistrosDelDia({ project_id, fecha }) {
    return executeTransaction(TX.GET_REGISTROS_DEL_DIA, { project_id, fecha }).then(unwrap);
  },
  eliminarRegistro(id) { return executeTransaction(TX.ELIMINAR_REGISTRO, { id }).then(unwrap); },
  getAcumuladoMes({ project_id, fecha }) {
    return executeTransaction(TX.GET_ACUMULADO_MES, { project_id, fecha }).then(unwrap);
  },
};

export default hoursService;
