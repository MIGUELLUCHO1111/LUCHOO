import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

class Carga {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  createCarga = async ({ vehicle_id, transaction_no, filled_at, liters, tank_full, station, odometer, amount, notes, responsible_id, fuel_type, created_by }) => {
    await this.dbmsReady;

    if (!vehicle_id || !liters) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'vehicle_id', 'liters'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    if (liters <= 0) {
      throw new Error(JSON.stringify({
        message: "Los litros deben ser mayores a 0",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    try {
      const result = await this.dbms.executeNamedQuery({
        nameQuery: 'createCarga',
        params: {
          vehicle_id,
          transaction_no: transaction_no || null,
          filled_at: filled_at || new Date().toISOString(),
          liters,
          tank_full: tank_full || false,
          station: station || null,
          odometer: odometer || null,
          amount: amount || null,
          notes: notes || null,
          responsible_id: responsible_id || null,
          fuel_type: fuel_type || 'gasolina',
          created_by: created_by || null,
        },
      });

      const carga = result?.rows?.[0];
      return { statusCode: STATUS_CODES.CREATED, data: carga, message: 'Carga registrada exitosamente' };
    } catch (error) {
      throw error;
    }
  };

  getCargaById = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getCargaById',
      params: { id },
    });

    const carga = result?.rows?.[0];
    if (!carga) {
      throw new Error(JSON.stringify({
        message: `Carga con id ${id} no encontrada`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, data: carga };
  };

  getCargasByVehiculo = async ({ vehicle_id }) => {
    await this.dbmsReady;

    if (!vehicle_id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'vehicle_id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getCargasByVehiculo',
      params: { vehicle_id },
    });

    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  getAllCargas = async () => {
    await this.dbmsReady;

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getAllCargas',
      params: {},
    });

    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  updateCarga = async ({ id, transaction_no, liters, tank_full, station, odometer, amount, notes, responsible_id, fuel_type }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'updateCarga',
      params: { id, transaction_no: transaction_no || null, liters, tank_full: tank_full || false, station: station || null, odometer: odometer || null, amount: amount || null, notes: notes || null, responsible_id: responsible_id || null, fuel_type: fuel_type || 'gasolina' },
    });

    const carga = result?.rows?.[0];
    if (!carga) {
      throw new Error(JSON.stringify({
        message: `Carga con id ${id} no encontrada`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, data: carga, message: 'Carga actualizada' };
  };

  deleteCarga = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'deleteCarga',
      params: { id },
    });

    const carga = result?.rows?.[0];
    if (!carga) {
      throw new Error(JSON.stringify({
        message: `Carga con id ${id} no encontrada`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, message: 'Carga eliminada' };
  };
}

export default Carga;
