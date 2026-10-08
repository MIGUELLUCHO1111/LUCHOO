import { MntBase, STATUS_CODES, badRequest, forbidden, notFound, conflict, isSupervisor, FAILURE_SYSTEMS, text, amount, oneOf } from './mntCommon.js';

// Catálogos de Mantenimiento (063): servicios (tarea tipo con su sistema y
// duración estimada, se agregan a una OT con un clic) y proveedores /
// talleres externos con su tipo. Se llama CatalogoMnt porque "Catalogo" ya
// es la clase de modelos de Flota y los nombres de clase son globales.

const SERVICE_KINDS = ['PREVENTIVO', 'CORRECTIVO', 'INSPECCION'];

const dup = (e) => String(e?.message || '').includes('uq_mnt_');

class CatalogoMnt extends MntBase {
  listarServiciosMnt = async () => ({ statusCode: STATUS_CODES.OK, data: await this.query('mntListServices') });

  guardarServicioMnt = async ({ id, name, system, kind, est_minutes, description, caller_profile }) => {
    if (!isSupervisor(caller_profile)) throw forbidden('Solo el Supervisor de Mantenimiento o la Gerencia editan el catálogo de servicios.');
    const nombre = text(name, 150);
    if (!nombre) throw badRequest('Escribe el nombre del servicio.');
    const min = amount(est_minutes, 'La duración');
    const params = {
      name: nombre, system: oneOf(system, FAILURE_SYSTEMS, 'Sistema') || null,
      kind: oneOf(kind, SERVICE_KINDS, 'Tipo') || 'PREVENTIVO', est_minutes: min ? Math.round(min) : null, description: text(description, 2000) || null,
    };
    try {
      if (id) {
        if (!(await this.query('mntUpdateService', { id: Number(id), ...params })).length) throw notFound('Servicio no encontrado.');
      } else await this.query('mntInsertService', params);
    } catch (e) {
      if (dup(e)) throw conflict(`Ya existe un servicio llamado "${nombre}".`);
      throw e;
    }
    return this.listarServiciosMnt();
  };

  archivarServicioMnt = async ({ id, active = false, caller_profile }) => {
    if (!isSupervisor(caller_profile)) throw forbidden('Solo el Supervisor de Mantenimiento o la Gerencia editan el catálogo de servicios.');
    if (!(await this.query('mntSetServiceActive', { id: Number(id), active: !!active })).length) throw notFound('Servicio no encontrado.');
    return this.listarServiciosMnt();
  };

  listarProveedoresMnt = async () => ({ statusCode: STATUS_CODES.OK, data: await this.query('mntListProviders') });

  guardarProveedorMnt = async ({ id, name, type, rif, contact, phone, email, notes, caller_profile }) => {
    if (!isSupervisor(caller_profile)) throw forbidden('Solo el Supervisor de Mantenimiento o la Gerencia editan los proveedores.');
    const nombre = text(name, 150);
    if (!nombre) throw badRequest('Escribe el nombre del proveedor.');
    const params = {
      name: nombre, type: text(type, 40) || null, rif: text(rif, 30) || null, contact: text(contact, 150) || null,
      phone: text(phone, 40) || null, email: text(email, 150) || null, notes: text(notes, 2000) || null,
    };
    try {
      if (id) {
        if (!(await this.query('mntUpdateProvider', { id: Number(id), ...params })).length) throw notFound('Proveedor no encontrado.');
      } else await this.query('mntInsertProvider', params);
    } catch (e) {
      if (dup(e)) throw conflict(`Ya existe un proveedor llamado "${nombre}".`);
      throw e;
    }
    return this.listarProveedoresMnt();
  };

  archivarProveedorMnt = async ({ id, active = false, caller_profile }) => {
    if (!isSupervisor(caller_profile)) throw forbidden('Solo el Supervisor de Mantenimiento o la Gerencia editan los proveedores.');
    if (!(await this.query('mntSetProviderActive', { id: Number(id), active: !!active })).length) throw notFound('Proveedor no encontrado.');
    return this.listarProveedoresMnt();
  };
}

export default CatalogoMnt;
