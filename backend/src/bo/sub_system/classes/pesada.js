import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import { generateFuelTransactionNo } from './fuelTransactionNo.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

const GALLONS_TO_LITERS = 3.78541;

class Pesada {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  // Crea la carga pesada y, si hay un tanque de gasoil activo, descuenta los
  // litros equivalentes en una sola transacción real (begin/commit/rollback):
  // si el movimiento del tanque falla, la carga pesada tampoco queda creada.
  // transaction_no ya no lo manda el cliente (Julio, 21/09/2026) -- se
  // genera solo, FP-AADSMMDD### (DS = flota pesada/gasoil), dentro de la
  // misma transacción (mismo client) para que un rollback también revierta
  // el consecutivo consumido si el resto de la creación falla.
  createPesada = async ({ vehicle_id, filled_at, requester, fuel_type, measurement_value, measurement_type, gallons, notes, created_by }) => {
    await this.dbmsReady;

    if (!vehicle_id || !gallons) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'vehicle_id', 'gallons'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    if (gallons <= 0) {
      throw new Error(JSON.stringify({
        message: "Los galones deben ser mayores a 0",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const resolvedFuelType = fuel_type || 'gasoil';
    const resolvedFilledAt = filled_at || new Date().toISOString();
    const client = await this.dbms.beginTransaction();
    try {
      const transaction_no = await generateFuelTransactionNo({
        dbms: this.dbms,
        client,
        filled_at: resolvedFilledAt,
        fleetCode: 'DS',
      });

      const pesadaResult = await this.dbms.executeNamedQuery({
        nameQuery: 'createPesada',
        client,
        params: {
          vehicle_id,
          transaction_no,
          filled_at: resolvedFilledAt,
          requester: requester || null,
          fuel_type: resolvedFuelType,
          measurement_value: measurement_value ?? null,
          measurement_type: measurement_type || 'km',
          gallons,
          notes: notes || null,
          created_by: created_by || null,
        },
      });
      const pesada = pesadaResult?.rows?.[0];

      const tankResult = await this.dbms.executeNamedQuery({
        nameQuery: 'getActiveGasoilTank',
        client,
        params: { fuel_type: resolvedFuelType },
      });
      const tank = tankResult?.rows?.[0];

      let message = 'Carga pesada registrada exitosamente';
      if (tank) {
        const quantityLiters = +(gallons * GALLONS_TO_LITERS).toFixed(2);
        await this.dbms.executeNamedQuery({
          nameQuery: 'createTankMovement',
          client,
          params: {
            tank_id: tank.id,
            movement_type: 'out',
            quantity_liters: quantityLiters,
            reference_type: 'pesada',
            reference_id: pesada.id,
            notes: null,
            created_by: created_by || null,
          },
        });
      } else {
        message = 'Carga pesada registrada; no hay tanque de gasoil activo para descontar';
      }

      await this.dbms.commitTransaction(client);
      return { statusCode: STATUS_CODES.CREATED, data: pesada, message };
    } catch (error) {
      await this.dbms.rollbackTransaction(client);
      throw error;
    } finally {
      await this.dbms.endTransaction(client);
    }
  };

  getPesadaById = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getPesadaById',
      params: { id },
    });

    const pesada = result?.rows?.[0];
    if (!pesada) {
      throw new Error(JSON.stringify({
        message: `Carga pesada con id ${id} no encontrada`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, data: pesada };
  };

  getAllPesada = async () => {
    await this.dbmsReady;

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getAllPesada',
      params: {},
    });

    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  updatePesada = async ({ id, filled_at, requester, fuel_type, measurement_value, measurement_type, gallons, notes }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'updatePesada',
      params: {
        id,
        filled_at: filled_at || new Date().toISOString(),
        requester: requester || null,
        fuel_type: fuel_type || 'gasoil',
        measurement_value: measurement_value ?? null,
        measurement_type: measurement_type || 'km',
        gallons,
        notes: notes || null,
      },
    });

    const pesada = result?.rows?.[0];
    if (!pesada) {
      throw new Error(JSON.stringify({
        message: `Carga pesada con id ${id} no encontrada`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, data: pesada, message: 'Carga pesada actualizada' };
  };

  deletePesada = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'deletePesada',
      params: { id },
    });

    const pesada = result?.rows?.[0];
    if (!pesada) {
      throw new Error(JSON.stringify({
        message: `Carga pesada con id ${id} no encontrada`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, message: 'Carga pesada eliminada' };
  };
}

export default Pesada;
