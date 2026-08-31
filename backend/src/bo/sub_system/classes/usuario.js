import bcrypt from 'bcrypt';
import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

export class Usuario {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  createUsuario = async (data = {}) => {
    const { name, first_name, last_name, email, password, profile_id = null, is_active = true } = data;

    if (!name || !first_name || !last_name || !email || !password) {
      throw new Error(
        JSON.stringify({
          message: "Campos requeridos: 'name', 'first_name', 'last_name', 'email', 'password'",
          statusCode: STATUS_CODES.BAD_REQUEST,
        }),
      );
    }

    await this.dbmsReady;

    const password_hash = await bcrypt.hash(password, 10);

    try {
      const result = await this.dbms.executeNamedQuery({
        nameQuery: 'insertUsuario',
        params: { nombre: name, email, password_hash, first_name, last_name, is_active },
      });

      const usuario_id = result?.rows?.[0]?.usuario_id;

      if (profile_id) {
        await this.dbms.executeNamedQuery({
          nameQuery: 'insertUserProfile',
          params: { user_id: usuario_id, profile_id },
        });
      }

      return { statusCode: STATUS_CODES.CREATED, data: { id: usuario_id }, message: 'Usuario creado exitosamente' };
    } catch (error) {
      const { code } = extractDbError(error);
      if (code === '23505') {
        throw new Error(
          JSON.stringify({
            message: `Ya existe un usuario con el correo o nombre de usuario indicado`,
            statusCode: STATUS_CODES.CONFLICT,
          }),
        );
      }
      throw error;
    }
  };

  getAllUsuarios = async () => {
    await this.dbmsReady;
    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getAllUsuarios',
      params: {},
    });
    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  getUsuarioById = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({ message: "Campo requerido: 'id'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getUsuarioById',
      params: { id },
    });

    const usuario = result?.rows?.[0];
    if (!usuario) {
      throw new Error(JSON.stringify({ message: `Usuario con id ${id} no encontrado`, statusCode: STATUS_CODES.NOT_FOUND }));
    }

    return { statusCode: STATUS_CODES.OK, data: usuario };
  };

  getUsuarioByEmail = async ({ email }) => {
    await this.dbmsReady;

    if (!email) {
      throw new Error(JSON.stringify({ message: "Campo requerido: 'email'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getUsuarioByEmail',
      params: { email },
    });

    const usuario = result?.rows?.[0];
    if (!usuario) {
      throw new Error(JSON.stringify({ message: `Usuario con email '${email}' no encontrado`, statusCode: STATUS_CODES.NOT_FOUND }));
    }

    return { statusCode: STATUS_CODES.OK, data: usuario };
  };

  updateUsuario = async (data = {}) => {
    const { id, first_name, last_name, email, is_active = true, password = null, profile_id = null } = data;

    if (!id || !first_name || !last_name || !email) {
      throw new Error(
        JSON.stringify({
          message: "Campos requeridos: 'id', 'first_name', 'last_name', 'email'",
          statusCode: STATUS_CODES.BAD_REQUEST,
        }),
      );
    }

    await this.dbmsReady;

    try {
      const result = await this.dbms.executeNamedQuery({
        nameQuery: 'updateUsuario',
        params: { id, first_name, last_name, email, is_active },
      });

      const usuario = result?.rows?.[0];
      if (!usuario) {
        throw new Error(JSON.stringify({ message: `Usuario con id ${id} no encontrado`, statusCode: STATUS_CODES.NOT_FOUND }));
      }

      if (password) {
        const password_hash = await bcrypt.hash(password, 10);
        await this.dbms.executeNamedQuery({
          nameQuery: 'updateUserPassword',
          params: { password: password_hash, userId: id },
        });
      }

      await this.dbms.executeNamedQuery({
        nameQuery: 'deleteUserProfilesByUser',
        params: { user_id: id },
      });
      if (profile_id) {
        await this.dbms.executeNamedQuery({
          nameQuery: 'insertUserProfile',
          params: { user_id: id, profile_id },
        });
      }

      return { statusCode: STATUS_CODES.OK, data: usuario, message: 'Usuario actualizado' };
    } catch (error) {
      const { code } = extractDbError(error);
      if (code === '23505') {
        throw new Error(
          JSON.stringify({ message: `Ya existe un usuario con ese correo`, statusCode: STATUS_CODES.CONFLICT }),
        );
      }
      throw error;
    }
  };

  deleteUsuario = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({ message: "Campo requerido: 'id'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'deleteUsuario',
      params: { id },
    });

    const usuario = result?.rows?.[0];
    if (!usuario) {
      throw new Error(JSON.stringify({ message: `Usuario con id ${id} no encontrado`, statusCode: STATUS_CODES.NOT_FOUND }));
    }

    return { statusCode: STATUS_CODES.OK, message: 'Usuario eliminado' };
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

export default Usuario;
