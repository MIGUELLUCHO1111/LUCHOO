import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import { assertProjectAccess } from './projectAccess.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

class Registro {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  // Crea o corrige (upsert por proyecto+equipo+fecha) el registro diario de
  // un equipo -- así "guardar el día" sirve tanto para capturar por primera
  // vez como para corregir un día ya guardado.
  guardarRegistro = async ({
    project_id,
    equipment_id,
    fecha,
    executed_hours,
    pto_hours,
    standby_hours,
    contracted_hours,
    notes,
    created_by,
    caller_profile,
  }) => {
    await this.dbmsReady;

    if (!project_id || !equipment_id || !fecha) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'project_id', 'equipment_id', 'fecha'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    await assertProjectAccess(this.dbms, { caller_profile, project_id });

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'upsertRegistroDiario',
      params: {
        project_id,
        equipment_id,
        fecha,
        executed_hours: executed_hours || 0,
        pto_hours: pto_hours || 0,
        standby_hours: standby_hours || 0,
        contracted_hours: contracted_hours || 0,
        notes: notes || null,
        created_by: created_by || null,
      },
    });

    const registro = result?.rows?.[0];
    return { statusCode: STATUS_CODES.CREATED, data: registro, message: 'Registro guardado' };
  };

  getRegistrosDelDia = async ({ project_id, fecha, caller_profile }) => {
    await this.dbmsReady;

    if (!project_id || !fecha) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'project_id', 'fecha'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    await assertProjectAccess(this.dbms, { caller_profile, project_id });

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getRegistrosPorProyectoYFecha',
      params: { project_id, fecha },
    });

    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  // Acumulado del mes POR EQUIPO, hasta el día ANTERIOR a `fecha` (no
  // incluye el propio día que se está rellenando -- el frontend le suma el
  // borrador del día actual para mostrar el acumulado "con hoy" en vivo,
  // igual que las columnas ACUMULADO MES del Excel de referencia).
  getAcumuladoMes = async ({ project_id, fecha, caller_profile }) => {
    await this.dbmsReady;

    if (!project_id || !fecha) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'project_id', 'fecha'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    await assertProjectAccess(this.dbms, { caller_profile, project_id });

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getAcumuladoMesPorProyecto',
      params: { project_id, fecha },
    });

    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  eliminarRegistro = async ({ id, caller_profile }) => {
    await this.dbmsReady;

    if (!id) {
      throw new Error(JSON.stringify({
        message: "Campo requerido: 'id'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const projectRow = await this.dbms.executeNamedQuery({
      nameQuery: 'getRegistroProjectId',
      params: { id },
    });
    const projectId = projectRow?.rows?.[0]?.project_id;
    if (!projectId) {
      throw new Error(JSON.stringify({
        message: `Registro con id ${id} no encontrado`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }
    await assertProjectAccess(this.dbms, { caller_profile, project_id: projectId });

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'deleteRegistroDiario',
      params: { id },
    });

    const registro = result?.rows?.[0];
    if (!registro) {
      throw new Error(JSON.stringify({
        message: `Registro con id ${id} no encontrado`,
        statusCode: STATUS_CODES.NOT_FOUND,
      }));
    }

    return { statusCode: STATUS_CODES.OK, message: 'Registro eliminado' };
  };
}

export default Registro;
