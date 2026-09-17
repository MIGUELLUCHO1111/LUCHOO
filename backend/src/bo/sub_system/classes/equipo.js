import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

class Equipo {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  createEquipo = async ({ code, name }) => {
    await this.dbmsReady;

    if (!code) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'code'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    try {
      const result = await this.dbms.executeNamedQuery({
        nameQuery: 'createEquipoHoras',
        params: { code, name: name || null },
      });

      const equipo = result?.rows?.[0];
      return { statusCode: STATUS_CODES.CREATED, data: equipo, message: 'Equipo creado exitosamente' };
    } catch (error) {
      const dbError = extractDbError(error);
      if (dbError.code === '23505') {
        throw new Error(JSON.stringify({
          message: `Ya existe un equipo con el código '${code}'`,
          statusCode: STATUS_CODES.CONFLICT,
        }));
      }
      throw error;
    }
  };

  getEquipoById = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getEquipoHorasById',
      params: { id },
    });

    const equipo = result?.rows?.[0];
    if (!equipo) {
      throw new Error(JSON.stringify({
        message: `Equipo con id ${id} no encontrado`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, data: equipo };
  };

  getAllEquipos = async () => {
    await this.dbmsReady;

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getAllEquiposHoras',
      params: {},
    });

    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  updateEquipo = async ({ id, name, is_active }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'updateEquipoHoras',
      params: { id, name: name || null, is_active: is_active !== false },
    });

    const equipo = result?.rows?.[0];
    if (!equipo) {
      throw new Error(JSON.stringify({
        message: `Equipo con id ${id} no encontrado`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, data: equipo, message: 'Equipo actualizado' };
  };

  deleteEquipo = async ({ id }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'deleteEquipoHoras',
      params: { id },
    });

    const equipo = result?.rows?.[0];
    if (!equipo) {
      throw new Error(JSON.stringify({
        message: `Equipo con id ${id} no encontrado`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, message: 'Equipo eliminado' };
  };

  // Un equipo, un solo proyecto vigente a la vez -- cierra la asignación
  // abierta anterior (si existe) y crea la nueva, en una sola transacción.
  asignarAProyecto = async ({ equipo_id, project_id, assigned_from }) => {
    await this.dbmsReady;

    if (!equipo_id || !project_id || !assigned_from) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'equipo_id', 'project_id', 'assigned_from'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    // Ambos pasos son "seguros por construcción", no solo por lo que hace
    // el código: cerrar excluye explícitamente al proyecto destino (nunca
    // cierra una fila que ya es la correcta) y crear usa NOT EXISTS (no
    // duplica si ya hay una vigente para ese proyecto). Un doble
    // clic/reintento para el mismo equipo+proyecto termina siendo un
    // no-op real, no una fila con fecha invertida como pasaba antes. El
    // índice único parcial (idx_assignment_equipment_open, migración 020)
    // es el respaldo final para el caso límite de dos peticiones
    // corriendo en paralelo de verdad.
    const client = await this.dbms.beginTransaction();
    try {
      await this.dbms.executeNamedQuery({
        nameQuery: 'cerrarAsignacionAbiertaExceptoProyecto',
        params: { equipment_id: equipo_id, new_from: assigned_from, project_id },
        client,
      });

      const result = await this.dbms.executeNamedQuery({
        nameQuery: 'crearAsignacionSiNoExiste',
        params: { project_id, equipment_id: equipo_id, assigned_from },
        client,
      });

      await this.dbms.commitTransaction(client);

      if (!result?.rows?.[0]) {
        return { statusCode: STATUS_CODES.OK, message: 'El equipo ya estaba asignado a este proyecto' };
      }
      return { statusCode: STATUS_CODES.CREATED, data: result.rows[0], message: 'Equipo asignado al proyecto' };
    } catch (error) {
      await this.dbms.rollbackTransaction(client);
      const dbError = extractDbError(error);
      if (dbError.code === '23505' || dbError.code === '23514') {
        throw new Error(JSON.stringify({
          message: 'Este equipo ya fue asignado en otra petición mientras tanto -- recarga e intenta de nuevo',
          statusCode: STATUS_CODES.CONFLICT,
        }));
      }
      throw error;
    } finally {
      await this.dbms.endTransaction(client);
    }
  };

  // Deja al equipo sin proyecto (cierra la asignación abierta, si existe,
  // sin abrir una nueva) -- efectivo desde `effective_from` en adelante.
  quitarAsignacion = async ({ equipo_id, effective_from }) => {
    await this.dbmsReady;

    if (!equipo_id || !effective_from) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'equipo_id', 'effective_from'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    await this.dbms.executeNamedQuery({
      nameQuery: 'cerrarAsignacionAbierta',
      params: { equipment_id: equipo_id, new_from: effective_from },
    });

    return { statusCode: STATUS_CODES.OK, message: 'Equipo desasignado del proyecto' };
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

export default Equipo;
