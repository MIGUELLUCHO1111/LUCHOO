import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

class Vehiculo {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  createVehiculo = async ({ codigo, nombre, placa, tanque_capacidad_litros }) => {
    await this.dbmsReady;

    if (!codigo || !nombre) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'codigo', 'nombre'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    try {
      const result = await this.dbms.executeNamedQuery({
        nameQuery: 'createVehiculo',
        params: { codigo, nombre, placa: placa || null, tanque_capacidad_litros: tanque_capacidad_litros || 0 },
      });

      const vehiculo = result?.rows?.[0];
      return { statusCode: STATUS_CODES.CREATED, data: vehiculo, message: 'Vehículo creado exitosamente' };
    } catch (error) {
      const dbError = extractDbError(error);
      if (dbError.code === '23505') {
        throw new Error(JSON.stringify({
          message: `Ya existe un vehículo con el código '${codigo}'`,
          statusCode: STATUS_CODES.CONFLICT,
        }));
      }
      throw error;
    }
  };

  getVehiculoById = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getVehiculoById',
      params: { id },
    });

    const vehiculo = result?.rows?.[0];
    if (!vehiculo) {
      throw new Error(JSON.stringify({
        message: `Vehículo con id ${id} no encontrado`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, data: vehiculo };
  };

  getAllVehiculos = async () => {
    await this.dbmsReady;

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getAllVehiculos',
      params: {},
    });

    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  updateVehiculo = async ({ id, nombre, placa, tanque_capacidad_litros }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    try {
      const result = await this.dbms.executeNamedQuery({
        nameQuery: 'updateVehiculo',
        params: { id, nombre, placa: placa || null, tanque_capacidad_litros: tanque_capacidad_litros || 0 },
      });

      const vehiculo = result?.rows?.[0];
      if (!vehiculo) {
        throw new Error(JSON.stringify({
          message: `Vehículo con id ${id} no encontrado`,
          statusCode: STATUS_CODES.NOT_FOUND,
        }));
      }

      return { statusCode: STATUS_CODES.OK, data: vehiculo, message: 'Vehículo actualizado' };
    } catch (error) {
      const dbError = extractDbError(error);
      if (dbError.code === '23505') {
        throw new Error(JSON.stringify({
          message: `Ya existe un vehículo con ese código`,
          statusCode: STATUS_CODES.CONFLICT,
        }));
      }
      throw error;
    }
  };

  deleteVehiculo = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'deleteVehiculo',
      params: { id },
    });

    const vehiculo = result?.rows?.[0];
    if (!vehiculo) {
      throw new Error(JSON.stringify({
        message: `Vehículo con id ${id} no encontrado`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, message: 'Vehículo eliminado' };
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

export default Vehiculo;
