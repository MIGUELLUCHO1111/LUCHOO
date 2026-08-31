import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

export class Profile {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  createProfile = async (data = {}) => {
    const { profile_name, description = null } = data;

    if (!profile_name) {
      throw new Error(JSON.stringify({ message: "Campo requerido: 'profile_name'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }

    await this.dbmsReady;

    try {
      const result = await this.dbms.executeNamedQuery({
        nameQuery: 'insertProfile',
        params: { profile_name, description },
      });
      return { statusCode: STATUS_CODES.CREATED, data: result?.rows?.[0], message: 'Perfil creado exitosamente' };
    } catch (error) {
      const { code } = extractDbError(error);
      if (code === '23505') {
        throw new Error(JSON.stringify({ message: `Ya existe un perfil con el nombre '${profile_name}'`, statusCode: STATUS_CODES.CONFLICT }));
      }
      throw error;
    }
  };

  getProfileByName = async (data = {}) => {
    const { profile_name } = data;

    if (!profile_name) {
      throw new Error(JSON.stringify({ message: "Campo requerido: 'profile_name'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }

    await this.dbmsReady;

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getProfileByName',
      params: { profile_name },
    });

    const profile = result?.rows?.[0];
    if (!profile) {
      throw new Error(JSON.stringify({ message: `Perfil '${profile_name}' no encontrado`, statusCode: STATUS_CODES.NOT_FOUND }));
    }

    return { statusCode: STATUS_CODES.OK, data: profile };
  };

  assignProfileToUser = async (data = {}) => {
    const { user_id, profile_id } = data;

    if (!user_id || !profile_id) {
      throw new Error(JSON.stringify({ message: "Campos requeridos: 'user_id', 'profile_id'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }

    await this.dbmsReady;

    try {
      const result = await this.dbms.executeNamedQuery({
        nameQuery: 'insertUserProfile',
        params: { user_id, profile_id },
      });
      return { statusCode: STATUS_CODES.CREATED, data: result?.rows?.[0], message: 'Perfil asignado' };
    } catch (error) {
      const { code } = extractDbError(error);
      if (code === '23505') {
        throw new Error(JSON.stringify({ message: 'El usuario ya tiene asignado ese perfil', statusCode: STATUS_CODES.CONFLICT }));
      }
      throw error;
    }
  };

  getAllProfiles = async () => {
    await this.dbmsReady;
    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getAllProfiles',
      params: {},
    });
    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  getProfileById = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({ message: "Campo requerido: 'id'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getProfileById',
      params: { id },
    });

    const profile = result?.rows?.[0];
    if (!profile) {
      throw new Error(JSON.stringify({ message: `Perfil con id ${id} no encontrado`, statusCode: STATUS_CODES.NOT_FOUND }));
    }

    return { statusCode: STATUS_CODES.OK, data: profile };
  };

  updateProfile = async (data = {}) => {
    const { id, name, description = null, is_active = true } = data;

    if (!id || !name) {
      throw new Error(JSON.stringify({ message: "Campos requeridos: 'id', 'name'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }

    await this.dbmsReady;

    try {
      const result = await this.dbms.executeNamedQuery({
        nameQuery: 'updateProfile',
        params: { id, name, description, is_active },
      });

      const profile = result?.rows?.[0];
      if (!profile) {
        throw new Error(JSON.stringify({ message: `Perfil con id ${id} no encontrado`, statusCode: STATUS_CODES.NOT_FOUND }));
      }

      return { statusCode: STATUS_CODES.OK, data: profile, message: 'Perfil actualizado' };
    } catch (error) {
      const { code } = extractDbError(error);
      if (code === '23505') {
        throw new Error(JSON.stringify({ message: `Ya existe un perfil con el nombre '${name}'`, statusCode: STATUS_CODES.CONFLICT }));
      }
      throw error;
    }
  };

  deleteProfile = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({ message: "Campo requerido: 'id'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'deactivateProfile',
      params: { id },
    });

    const profile = result?.rows?.[0];
    if (!profile) {
      throw new Error(JSON.stringify({ message: `Perfil con id ${id} no encontrado`, statusCode: STATUS_CODES.NOT_FOUND }));
    }

    return { statusCode: STATUS_CODES.OK, message: 'Perfil desactivado' };
  };

  removeProfileFromUser = async (data = {}) => {
    const { user_id, profile_id } = data;

    if (!user_id || !profile_id) {
      throw new Error(JSON.stringify({ message: "Campos requeridos: 'user_id', 'profile_id'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }

    await this.dbmsReady;

    await this.dbms.executeNamedQuery({
      nameQuery: 'deleteUserProfileByIds',
      params: { user_id, profile_id },
    });

    return { statusCode: STATUS_CODES.OK, message: 'Perfil removido del usuario' };
  };

  getProfilesByUser = async (data = {}) => {
    const { user_id } = data;

    if (!user_id) {
      throw new Error(JSON.stringify({ message: "Campo requerido: 'user_id'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }

    await this.dbmsReady;

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getProfilesByUserId',
      params: { user_id },
    });

    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };
}

function extractDbError(error, depth = 0) {
  if (!error || typeof error !== 'object' || depth > 6) return {};
  let { code, detail } = error;
  if (code) return { code, detail };
  if (typeof error.message === 'string' && error.message.trimStart().startsWith('{')) {
    try {
      const inner = extractDbError(JSON.parse(error.message), depth + 1);
      if (inner.code) return inner;
    } catch (_) {}
  }
  if (error.error) {
    const inner = extractDbError(error.error, depth + 1);
    if (inner.code) return inner;
  }
  return { code, detail };
}

export default Profile;
