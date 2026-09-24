import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

class Empresa {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  createEmpresa = async ({ name }) => {
    await this.dbmsReady;

    if (!name) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'name'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'createEmpresa',
      params: { name },
    });

    const empresa = result?.rows?.[0];
    return { statusCode: STATUS_CODES.CREATED, data: empresa, message: 'Empresa creada exitosamente' };
  };

  getEmpresaById = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getEmpresaById',
      params: { id },
    });

    const empresa = result?.rows?.[0];
    if (!empresa) {
      throw new Error(JSON.stringify({
        message: `Empresa con id ${id} no encontrada`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, data: empresa };
  };

  getAllEmpresas = async () => {
    await this.dbmsReady;

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getAllEmpresas',
      params: {},
    });

    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  updateEmpresa = async ({ id, name, is_active }) => {
    await this.dbmsReady;

    if (!id || !name) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'id', 'name'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'updateEmpresa',
      params: { id, name, is_active: is_active !== false },
    });

    const empresa = result?.rows?.[0];
    if (!empresa) {
      throw new Error(JSON.stringify({
        message: `Empresa con id ${id} no encontrada`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, data: empresa, message: 'Empresa actualizada' };
  };

  deleteEmpresa = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'deleteEmpresa',
      params: { id },
    });

    const empresa = result?.rows?.[0];
    if (!empresa) {
      throw new Error(JSON.stringify({
        message: `Empresa con id ${id} no encontrada`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, message: 'Empresa eliminada' };
  };
}

export default Empresa;
