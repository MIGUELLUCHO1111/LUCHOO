import {
  MntBase, STATUS_CODES, badRequest, forbidden, notFound, conflict,
  PRIORITIES, FAILURE_SYSTEMS, isSupervisor, text, oneOf,
} from './mntCommon.js';

// Incidencias: el problema que se reporta en una unidad (falla, hallazgo de
// una inspección, observación del operador). Se resuelven dentro de una OT:
// al crear la OT se eligen las incidencias abiertas de esa unidad, quedan
// EN_OT y pasan a RESUELTA cuando la OT se cierra (o vuelven a ABIERTA si la
// OT se rechaza o anula). Más adelante Informes (inspección pre-uso) podrá
// crearlas con source INSPECCION.

class Incidencia extends MntBase {
  listarIncidencias = async ({ unit_id } = {}) => {
    const rows = await this.query('mntListIncidents', { unit_id: unit_id ? Number(unit_id) : null, work_order_id: null });
    return { statusCode: STATUS_CODES.OK, data: rows };
  };

  // Unidades para los selectores de Mantenimiento: código, placa, tipo de
  // flota, criticidad y condición operativa.
  listarUnidadesMnt = async () => {
    const rows = await this.query('mntListUnitsForMnt');
    return { statusCode: STATUS_CODES.OK, data: rows };
  };

  crearIncidencia = async ({ unit_id, title, description, priority, failure_system, caller_user, caller_user_id }) => {
    if (!unit_id) throw badRequest('Elige la unidad.');
    const titulo = text(title, 200);
    if (!titulo) throw badRequest('Escribe qué se observó (ej. "Fuga de aceite en el cárter").');
    const [unit] = await this.query('mntGetUnit', { id: Number(unit_id) });
    if (!unit || unit.deleted_at) throw notFound('La unidad no existe o fue dada de baja.');
    const [{ id }] = await this.query('mntInsertIncident', {
      unit_id: Number(unit_id), title: titulo, description: text(description, 4000) || null,
      priority: oneOf(priority, PRIORITIES, 'Prioridad') || 'MEDIA',
      failure_system: oneOf(failure_system, FAILURE_SYSTEMS, 'Sistema') || null,
      source: 'MANUAL', reported_by: caller_user || null, reported_by_user_id: caller_user_id ? Number(caller_user_id) : null,
    });
    await this.fleetEvent(unit_id, `Incidencia reportada: ${titulo}`, null, caller_user);
    return { statusCode: STATUS_CODES.CREATED, data: (await this.query('mntGetIncident', { id: Number(id) }))[0], message: 'Incidencia anotada' };
  };

  actualizarIncidencia = async ({ id, title, description, priority, failure_system }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    const [inc] = await this.query('mntGetIncident', { id: Number(id) });
    if (!inc) throw notFound('Incidencia no encontrada.');
    if (['RESUELTA', 'DESCARTADA'].includes(inc.status)) throw conflict('La incidencia ya está cerrada.');
    const patch = {};
    if (title !== undefined) { const t = text(title, 200); if (!t) throw badRequest('El título no puede quedar vacío.'); patch.title = t; }
    if (description !== undefined) patch.description = text(description, 4000);
    if (priority !== undefined) patch.priority = oneOf(priority, PRIORITIES, 'Prioridad') || 'MEDIA';
    if (failure_system !== undefined) patch.failure_system = oneOf(failure_system, FAILURE_SYSTEMS, 'Sistema');
    if (Object.keys(patch).length) await this.query('mntUpdateIncident', { id: Number(id), patch: JSON.stringify(patch) });
    return { statusCode: STATUS_CODES.OK, data: (await this.query('mntGetIncident', { id: Number(id) }))[0], message: 'Incidencia actualizada' };
  };

  // Descartar: no requiere trabajo (falsa alarma, duplicada, ya resuelta en sitio).
  descartarIncidencia = async ({ id, reason, caller_profile, caller_user }) => {
    if (!isSupervisor(caller_profile)) throw forbidden('Descarta una incidencia el Supervisor de Mantenimiento o la Gerencia.');
    const [inc] = await this.query('mntGetIncident', { id: Number(id) });
    if (!inc) throw notFound('Incidencia no encontrada.');
    if (inc.status !== 'ABIERTA') throw conflict('Solo se descarta una incidencia abierta (la que ya está en una OT se cierra con la OT).');
    const motivo = text(reason, 1000);
    if (!motivo) throw badRequest('Escribe por qué se descarta.');
    await this.query('mntUpdateIncident', { id: Number(id), patch: JSON.stringify({ status: 'DESCARTADA', close_note: motivo }) });
    await this.fleetEvent(inc.unit_id, `Incidencia descartada: ${inc.title}`, motivo, caller_user);
    return { statusCode: STATUS_CODES.OK, data: (await this.query('mntGetIncident', { id: Number(id) }))[0], message: 'Incidencia descartada' };
  };
}

export default Incidencia;
