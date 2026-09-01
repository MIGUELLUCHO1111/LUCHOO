import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

class Tanque {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  createTank = async ({ code, name, capacity_liters, min_alert_liters, fuel_type }) => {
    await this.dbmsReady;

    if (!code || !name || !capacity_liters) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'code', 'name', 'capacity_liters'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    try {
      const result = await this.dbms.executeNamedQuery({
        nameQuery: 'createTank',
        params: {
          code,
          name,
          capacity_liters,
          min_alert_liters: min_alert_liters ?? 0,
          fuel_type: fuel_type || 'gasoil',
        },
      });

      const tank = result?.rows?.[0];
      return { statusCode: STATUS_CODES.CREATED, data: tank, message: 'Tanque creado exitosamente' };
    } catch (error) {
      const dbError = extractDbError(error);
      if (dbError.code === '23505') {
        throw new Error(JSON.stringify({
          message: `Ya existe un tanque con el código '${code}'`,
          statusCode: STATUS_CODES.CONFLICT,
        }));
      }
      throw error;
    }
  };

  getAllTanks = async () => {
    await this.dbmsReady;

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getAllTanks',
      params: {},
    });

    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  getTankById = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getTankById',
      params: { id },
    });

    const tank = result?.rows?.[0];
    if (!tank) {
      throw new Error(JSON.stringify({
        message: `Tanque con id ${id} no encontrado`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, data: tank };
  };

  updateTank = async ({ id, name, capacity_liters, min_alert_liters, fuel_type, is_active }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'updateTank',
      params: {
        id,
        name,
        capacity_liters,
        min_alert_liters: min_alert_liters ?? 0,
        fuel_type: fuel_type || 'gasoil',
        is_active: is_active ?? true,
      },
    });

    const tank = result?.rows?.[0];
    if (!tank) {
      throw new Error(JSON.stringify({
        message: `Tanque con id ${id} no encontrado`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, data: tank, message: 'Tanque actualizado' };
  };

  deleteTank = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'deleteTank',
      params: { id },
    });

    const tank = result?.rows?.[0];
    if (!tank) {
      throw new Error(JSON.stringify({
        message: `Tanque con id ${id} no encontrado`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, message: 'Tanque eliminado' };
  };

  getMovementsByTank = async ({ tank_id }) => {
    await this.dbmsReady;

    if (!tank_id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'tank_id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getMovementsByTank',
      params: { tank_id },
    });

    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  // Alta manual de un movimiento (ej. abastecer el tanque = 'in').
  registerMovement = async ({ tank_id, movement_type, quantity_liters, reference_type, reference_id, notes, created_by }) => {
    await this.dbmsReady;

    if (!tank_id || !movement_type || !quantity_liters) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'tank_id', 'movement_type', 'quantity_liters'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    if (movement_type !== 'in' && movement_type !== 'out') {
      throw new Error(JSON.stringify({
        message: "'movement_type' debe ser 'in' o 'out'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    if (quantity_liters <= 0) {
      throw new Error(JSON.stringify({
        message: "'quantity_liters' debe ser mayor a 0",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'createTankMovement',
      params: {
        tank_id,
        movement_type,
        quantity_liters,
        reference_type: reference_type || 'manual',
        reference_id: reference_id || null,
        notes: notes || null,
        created_by: created_by || null,
      },
    });

    const movement = result?.rows?.[0];
    return { statusCode: STATUS_CODES.CREATED, data: movement, message: 'Movimiento registrado exitosamente' };
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

export default Tanque;
