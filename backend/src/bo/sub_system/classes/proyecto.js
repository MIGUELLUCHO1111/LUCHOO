import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import { assertProjectAccess, getAccessibleProjectIds } from './projectAccess.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

class Proyecto {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  createProyecto = async ({ company_id, name, tipo, responsible_person_id = null }) => {
    await this.dbmsReady;

    if (!company_id || !name || !tipo) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'company_id', 'name', 'tipo'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'createProyecto',
      params: { company_id, name, tipo, responsible_person_id },
    });

    const proyecto = result?.rows?.[0];
    return { statusCode: STATUS_CODES.CREATED, data: proyecto, message: 'Proyecto creado exitosamente' };
  };

  getProyectoById = async ({ id, caller_profile }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    await assertProjectAccess(this.dbms, { caller_profile, project_id: id });

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getProyectoById',
      params: { id },
    });

    const proyecto = result?.rows?.[0];
    if (!proyecto) {
      throw new Error(JSON.stringify({
        message: `Proyecto con id ${id} no encontrado`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, data: proyecto };
  };

  // Sin `caller_profile` (o admin) trae todos -- con un perfil de proyecto
  // asignado, solo los proyectos que ese perfil puede tocar (ver
  // project_profile_assignment / projectAccess.js).
  getAllProyectos = async ({ caller_profile } = {}) => {
    await this.dbmsReady;

    const accessibleIds = await getAccessibleProjectIds(this.dbms, caller_profile);

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getAllProyectos',
      params: {},
    });

    const rows = result?.rows || [];
    const filtered = accessibleIds ? rows.filter((p) => accessibleIds.includes(p.id)) : rows;
    return { statusCode: STATUS_CODES.OK, data: filtered };
  };

  getProyectosByEmpresa = async ({ company_id, caller_profile }) => {
    await this.dbmsReady;

    if (!company_id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'company_id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const accessibleIds = await getAccessibleProjectIds(this.dbms, caller_profile);

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getProyectosByEmpresa',
      params: { company_id },
    });

    const rows = result?.rows || [];
    const filtered = accessibleIds ? rows.filter((p) => accessibleIds.includes(p.id)) : rows;
    return { statusCode: STATUS_CODES.OK, data: filtered };
  };

  getEquiposAsignados = async ({ project_id, fecha, caller_profile }) => {
    await this.dbmsReady;

    if (!project_id || !fecha) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'project_id', 'fecha'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    await assertProjectAccess(this.dbms, { caller_profile, project_id });

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getEquiposAsignadosAProyecto',
      params: { project_id, fecha },
    });

    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  // ---------- Qué perfil(es) pueden rellenar este proyecto (admin) ----------

  asignarPerfil = async ({ project_id, profile_name }) => {
    await this.dbmsReady;

    if (!project_id || !profile_name) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'project_id', 'profile_name'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    await this.dbms.executeNamedQuery({
      nameQuery: 'assignProfileToProjectByName',
      params: { project_id, profile_name },
    });

    return { statusCode: STATUS_CODES.CREATED, message: `Perfil '${profile_name}' asignado al proyecto` };
  };

  quitarPerfil = async ({ project_id, profile_name }) => {
    await this.dbmsReady;

    if (!project_id || !profile_name) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'project_id', 'profile_name'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    await this.dbms.executeNamedQuery({
      nameQuery: 'removeProfileFromProjectByName',
      params: { project_id, profile_name },
    });

    return { statusCode: STATUS_CODES.OK, message: `Perfil '${profile_name}' removido del proyecto` };
  };

  getPerfilesAsignados = async ({ project_id }) => {
    await this.dbmsReady;

    if (!project_id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'project_id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getProjectProfiles',
      params: { project_id },
    });

    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  updateProyecto = async ({ id, name, tipo, is_active, responsible_person_id = null }) => {
    await this.dbmsReady;

    if (!id || !name || !tipo) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'id', 'name', 'tipo'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'updateProyecto',
      params: { id, name, tipo, is_active: is_active !== false, responsible_person_id },
    });

    const proyecto = result?.rows?.[0];
    if (!proyecto) {
      throw new Error(JSON.stringify({
        message: `Proyecto con id ${id} no encontrado`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, data: proyecto, message: 'Proyecto actualizado' };
  };

  deleteProyecto = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'deleteProyecto',
      params: { id },
    });

    const proyecto = result?.rows?.[0];
    if (!proyecto) {
      throw new Error(JSON.stringify({
        message: `Proyecto con id ${id} no encontrado`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, message: 'Proyecto eliminado' };
  };
}

export default Proyecto;
