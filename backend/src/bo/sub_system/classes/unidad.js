import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Tabla interna placa-unidad-conductor: la propuesta la señala como fuente
// complementaria porque el GPS no siempre identifica el conductor de forma
// confiable, y el código interno (ej. FP-CBA-01) no lo asigna la plataforma.
class Unidad {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  createUnidad = async ({ code, plate, driver_name }) => {
    await this.dbmsReady;

    if (!code) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'code'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    try {
      const result = await this.dbms.executeNamedQuery({
        nameQuery: 'createTrackerUnit',
        params: { code, plate: plate || null, driver_name: driver_name || null },
      });

      return { statusCode: STATUS_CODES.CREATED, data: result?.rows?.[0], message: 'Unidad creada exitosamente' };
    } catch (error) {
      const dbError = extractDbError(error);
      if (dbError.code === '23505') {
        throw new Error(JSON.stringify({
          message: `Ya existe una unidad con el código '${code}'`,
          statusCode: STATUS_CODES.CONFLICT,
        }));
      }
      throw error;
    }
  };

  getUnidadById = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getTrackerUnitById',
      params: { id },
    });

    const unidad = result?.rows?.[0];
    if (!unidad) {
      throw new Error(JSON.stringify({
        message: `Unidad con id ${id} no encontrada`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, data: unidad };
  };

  getAllUnidades = async () => {
    await this.dbmsReady;

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getAllTrackerUnits',
      params: {},
    });

    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  updateUnidad = async ({ id, plate, driver_name, is_active = true }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'updateTrackerUnit',
      params: { id, plate: plate || null, driver_name: driver_name || null, is_active },
    });

    const unidad = result?.rows?.[0];
    if (!unidad) {
      throw new Error(JSON.stringify({
        message: `Unidad con id ${id} no encontrada`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, data: unidad, message: 'Unidad actualizada' };
  };

  deleteUnidad = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'deleteTrackerUnit',
      params: { id },
    });

    const unidad = result?.rows?.[0];
    if (!unidad) {
      throw new Error(JSON.stringify({
        message: `Unidad con id ${id} no encontrada`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, message: 'Unidad eliminada' };
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

export default Unidad;
