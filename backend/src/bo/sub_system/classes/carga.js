import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

class Carga {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  createCarga = async ({ vehicle_id, fecha, litros, tanque_lleno, estacion, odometro, monto, observaciones, created_by }) => {
    await this.dbmsReady;

    if (!vehicle_id || !litros) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'vehicle_id', 'litros'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    if (litros <= 0) {
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
          fecha: fecha || new Date().toISOString(),
          litros,
          tanque_lleno: tanque_lleno || false,
          estacion: estacion || null,
          odometro: odometro || null,
          monto: monto || null,
          observaciones: observaciones || null,
          created_by: created_by || null,
        },
      });

      const carga = result?.rows?.[0];
      return { statusCode: STATUS_CODES.CREATED, data: carga, message: 'Carga registrada exitosamente' };
    } catch (error) {
      throw error;
    }
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

  updateCarga = async ({ id, litros, tanque_lleno, estacion, odometro, monto, observaciones }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'updateCarga',
      params: { id, litros, tanque_lleno: tanque_lleno || false, estacion: estacion || null, odometro: odometro || null, monto: monto || null, observaciones: observaciones || null },
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
