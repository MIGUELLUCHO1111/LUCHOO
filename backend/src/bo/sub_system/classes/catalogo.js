import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import { assertUnitAccess, assertAdmin, isAdminCaller } from './fleetAccess.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Catalogo de Flota (044_fleet_catalog.sql): marca -> modelo -> version, con
// foto. Cada unidad de fleet_unit elige su modelo aqui (fleet_unit_profile.
// model_id) en vez de escribir marca y modelo a mano. La foto se sube por
// la ruta aparte /fleet/models/photo (multipart), ver fleetPhotoRoutes.js.

const METERS = ['KM', 'HORAS', 'AMBOS'];
// Ilustraciones disponibles para una familia (deben existir en fleetArt.jsx).
const ARTS = ['crane', 'knuckle', 'forklift', 'loader', 'bucket', 'pickup', 'truck', 'tanker', 'machine'];

const badRequest = (message) => new Error(JSON.stringify({ message, statusCode: STATUS_CODES.BAD_REQUEST }));
const notFound = (message) => new Error(JSON.stringify({ message, statusCode: STATUS_CODES.NOT_FOUND }));
const text = (v) => (v == null ? null : String(v).trim() || null);
// "GROVE RT-760E" y "Grove RT760E" son el mismo modelo: se compara sin
// mayusculas, espacios, guiones ni puntos.
const norm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const conflict = (message, extra) => new Error(JSON.stringify({ message, statusCode: STATUS_CODES.CONFLICT, error: extra }));

class Catalogo {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  query = async (nameQuery, params = {}) => {
    await this.dbmsReady;
    const result = await this.dbms.executeNamedQuery({ nameQuery, params });
    return result?.rows || [];
  };

  evento = (unit_id, title, created_by) =>
    this.query('fleetInsertEvent', { unit_id, event_type: 'EDICION', title, detail: null, created_by: created_by || null });

  // Nombre unico (ver Ficha.listarFichas): 'listar' tambien existe en el Tracker.
  listarCatalogo = async ({ caller_profile, caller_user_id } = {}) => {
    const [todos, marcas, familias] = await Promise.all([this.query('fleetCatalogModels'), this.query('fleetCatalogBrands'), this.query('fleetListFamilies')]);
    const admin = isAdminCaller(caller_profile);
    const modelos = todos
      .filter((m) => admin || m.status === 'ACTIVO' || Number(m.proposed_by_user_id) === Number(caller_user_id))
      .map((m) => ({ ...m, mio: !!caller_user_id && Number(m.proposed_by_user_id) === Number(caller_user_id) }));
    const pendientes = admin ? todos.filter((m) => m.status === 'PENDIENTE').length : undefined;
    return { statusCode: STATUS_CODES.OK, data: { modelos, marcas, familias, pendientes } };
  };

  // Modelo vigente (activo o pendiente) que se llama igual, sin contar mayusculas ni signos.
  duplicadoDe = async (marca, modelo, exceptId = null) => {
    const clave = norm(marca) + '|' + norm(modelo);
    const vivos = await this.query('fleetLiveModelNames');
    return vivos.find((m) => Number(m.id) !== Number(exceptId) && norm(m.brand_name) + '|' + norm(m.name) === clave) || null;
  };

  guardarModelo = async ({ id, brand_name, name, category, body_type, capacity, fuel_type, meter_type, description, versions, caller_profile }) => {
    assertAdmin(caller_profile, 'crear o editar modelos del catálogo');
    const marca = text(brand_name);
    const modelo = text(name);
    if (!marca || !modelo) throw badRequest("Campos requeridos: 'brand_name' y 'name'");
    const dup = await this.duplicadoDe(marca, modelo, id);
    if (dup) throw conflict(`Ya existe "${dup.brand_name} ${dup.name}" en el catálogo${dup.status === 'PENDIENTE' ? ' (propuesto, pendiente de aprobar)' : ''}.`, { duplicado_id: Number(dup.id) });

    const [brand] = await this.query('fleetUpsertBrand', { name: marca });
    const campos = {
      brand_id: Number(brand.id),
      name: modelo,
      category: (text(category) || 'OTRO').toUpperCase().slice(0, 10),
      body_type: text(body_type),
      capacity: text(capacity),
      fuel_type: text(fuel_type),
      meter_type: METERS.includes(meter_type) ? meter_type : 'KM',
      description: text(description),
    };

    let modelId = id ? Number(id) : null;
    try {
      if (modelId) {
        const [row] = await this.query('fleetUpdateModel', { id: modelId, ...campos });
        if (!row) throw notFound(`Modelo con id ${modelId} no encontrado`);
      } else {
        const [row] = await this.query('fleetInsertModel', campos);
        modelId = Number(row.id);
      }
    } catch (error) {
      if (String(error?.message).includes('23505') || String(error?.message).includes('duplicate')) {
        throw new Error(JSON.stringify({ message: `Ya existe el modelo "${modelo}" de ${marca}`, statusCode: STATUS_CODES.CONFLICT }));
      }
      throw error;
    }

    // Versiones: se agregan las nuevas y se quitan las que ya no estan en la lista.
    if (Array.isArray(versions)) {
      const deseadas = [...new Set(versions.map(text).filter(Boolean))];
      const actuales = await this.query('fleetListVersions', { model_id: modelId });
      for (const v of actuales) {
        if (!deseadas.some((d) => d.toLowerCase() === v.name.toLowerCase())) {
          await this.query('fleetDeleteVersion', { id: Number(v.id), model_id: modelId });
        }
      }
      for (const nombre of deseadas) {
        if (!actuales.some((v) => v.name.toLowerCase() === nombre.toLowerCase())) {
          await this.query('fleetInsertVersion', { model_id: modelId, name: nombre });
        }
      }
    }

    return { statusCode: id ? STATUS_CODES.OK : STATUS_CODES.CREATED, data: { id: modelId }, message: id ? 'Modelo actualizado' : 'Modelo creado' };
  };

  // Familia = prefijo del codigo interno (FP-GT.06 -> GT). Crear o renombrar.
  guardarFamilia = async ({ code, name, art, caller_profile }) => {
    assertAdmin(caller_profile, 'crear o renombrar familias');
    const codigo = String(code || '').trim().toUpperCase();
    const nombre = text(name);
    if (!/^[A-Z0-9]{1,10}$/.test(codigo)) throw badRequest('El código de la familia debe tener de 1 a 10 letras o números (ej. GT, CBA)');
    if (!nombre) throw badRequest("Campo requerido: 'name'");
    const [row] = await this.query('fleetUpsertFamily', { code: codigo, name: nombre, art: ARTS.includes(art) ? art : 'truck' });
    return { statusCode: STATUS_CODES.OK, data: row, message: 'Familia guardada' };
  };

  eliminarFamilia = async ({ code, caller_profile }) => {
    assertAdmin(caller_profile, 'eliminar familias');
    const codigo = String(code || '').trim().toUpperCase();
    const [{ n } = { n: 0 }] = await this.query('fleetCountFamilyModels', { code: codigo });
    if (n > 0) {
      throw new Error(JSON.stringify({ message: `No se puede eliminar: ${n} modelo${n === 1 ? '' : 's'} usa${n === 1 ? '' : 'n'} esta familia. Cámbialos de familia primero.`, statusCode: STATUS_CODES.CONFLICT }));
    }
    const [row] = await this.query('fleetDeleteFamily', { code: codigo });
    if (!row) throw notFound(`Familia ${codigo} no encontrada`);
    return { statusCode: STATUS_CODES.OK, message: `Familia ${row.name} eliminada` };
  };

  archivarModelo = async ({ id, caller_profile }) => {
    assertAdmin(caller_profile, 'archivar modelos');
    if (!id) throw badRequest("Campo requerido: 'id'");
    const [row] = await this.query('fleetArchiveModel', { id });
    if (!row) throw notFound(`Modelo con id ${id} no encontrado`);
    return { statusCode: STATUS_CODES.OK, message: `Modelo "${row.name}" archivado` };
  };

  // Asocia varias unidades a un modelo (y opcionalmente a una version).
  asignarUnidades = async ({ model_id, unit_ids, version_id, caller_user, caller_profile, caller_user_id }) => {
    if (!model_id || !Array.isArray(unit_ids) || !unit_ids.length) throw badRequest("Campos requeridos: 'model_id' y 'unit_ids'");
    await this.dbmsReady;
    for (const unitId of unit_ids) await assertUnitAccess(this.dbms, { caller_profile, caller_user_id, unit_id: unitId });
    const [modelo] = await this.query('fleetGetModel', { id: model_id });
    if (!modelo || modelo.archived_at || modelo.status === 'RECHAZADO') throw notFound(`Modelo con id ${model_id} no encontrado`);
    if (modelo.status === 'PENDIENTE' && !isAdminCaller(caller_profile) && Number(modelo.proposed_by_user_id) !== Number(caller_user_id)) {
      throw badRequest('Ese modelo todavía está pendiente de aprobación.');
    }
    for (const unitId of unit_ids.map(Number).filter(Number.isInteger)) {
      await this.query('fleetSetUnitModel', { unit_id: unitId, model_id: String(model_id), version_id: version_id ? String(version_id) : null });
      await this.evento(unitId, `Modelo asignado: ${modelo.brand_name} ${modelo.name}`, caller_user);
    }
    return { statusCode: STATUS_CODES.OK, message: 'Unidades asociadas al modelo' };
  };

  // El encargado propone un modelo que no esta en el catalogo: queda
  // PENDIENTE y, si indica una de SUS unidades, se le asigna de una vez.
  proponerModelo = async ({ brand_name, name, category, body_type, capacity, fuel_type, meter_type, description, versions, unit_id, caller_profile, caller_user_id, caller_user }) => {
    const marca = text(brand_name);
    const modelo = text(name);
    if (!marca || !modelo) throw badRequest("Campos requeridos: 'brand_name' y 'name'");
    if (!caller_user_id) throw badRequest('Falta el usuario que propone');
    await this.dbmsReady;
    if (unit_id) await assertUnitAccess(this.dbms, { caller_profile, caller_user_id, unit_id });
    const dup = await this.duplicadoDe(marca, modelo);
    if (dup) {
      throw conflict(`"${dup.brand_name} ${dup.name}" ya está en el catálogo${dup.status === 'PENDIENTE' ? ' (propuesto por otro encargado)' : ''}: elígelo en vez de proponerlo de nuevo.`, { duplicado_id: Number(dup.id) });
    }
    const [brand] = await this.query('fleetUpsertBrand', { name: marca });
    const [row] = await this.query('fleetInsertModelProposal', {
      brand_id: Number(brand.id), name: modelo, category: (text(category) || 'OTRO').toUpperCase().slice(0, 10),
      body_type: text(body_type), capacity: text(capacity), fuel_type: text(fuel_type),
      meter_type: METERS.includes(meter_type) ? meter_type : 'KM', description: text(description), user_id: Number(caller_user_id),
    });
    const modelId = Number(row.id);
    for (const v of [...new Set((versions || []).map(text).filter(Boolean))]) await this.query('fleetInsertVersion', { model_id: modelId, name: v });
    if (unit_id) {
      await this.query('fleetSetUnitModel', { unit_id: Number(unit_id), model_id: String(modelId), version_id: null });
      await this.evento(Number(unit_id), `Modelo propuesto: ${marca} ${modelo} (pendiente de aprobación)`, caller_user);
    }
    return { statusCode: STATUS_CODES.CREATED, data: { id: modelId }, message: 'Modelo propuesto: queda pendiente hasta que un administrador lo apruebe' };
  };

  aprobarModelo = async ({ id, caller_profile, caller_user }) => {
    assertAdmin(caller_profile, 'aprobar modelos');
    const [row] = await this.query('fleetApproveModel', { id, reviewed_by: caller_user || null });
    if (!row) throw notFound(`No hay una propuesta pendiente con id ${id}`);
    return { statusCode: STATUS_CODES.OK, message: `Modelo "${row.name}" aprobado: ya está en el catálogo` };
  };

  // Rechaza una propuesta. Con fusionar_con_id, sus unidades pasan a ese
  // modelo existente; sin el, quedan sin modelo del catalogo.
  rechazarModelo = async ({ id, nota, fusionar_con_id, caller_profile, caller_user }) => {
    assertAdmin(caller_profile, 'rechazar o fusionar modelos');
    const [propuesta] = await this.query('fleetGetModel', { id });
    if (!propuesta || propuesta.status !== 'PENDIENTE') throw notFound(`No hay una propuesta pendiente con id ${id}`);
    let destino = null;
    if (fusionar_con_id) {
      [destino] = await this.query('fleetGetModel', { id: fusionar_con_id });
      if (!destino || destino.status !== 'ACTIVO' || destino.archived_at || Number(destino.id) === Number(id)) throw badRequest('El modelo con el que se fusiona debe estar activo en el catálogo.');
    }
    const [row] = await this.query('fleetRejectModel', { id, reviewed_by: caller_user || null, review_note: text(nota), merged_into_id: destino ? String(destino.id) : null });
    if (!row) throw notFound(`No hay una propuesta pendiente con id ${id}`);
    const unidades = destino
      ? await this.query('fleetMoveModelUnits', { from_id: Number(id), to_id: Number(destino.id) })
      : await this.query('fleetUnlinkModelUnits', { id: Number(id) });
    const titulo = destino
      ? `Modelo unificado: ${propuesta.brand_name} ${propuesta.name} → ${destino.brand_name} ${destino.name}`
      : `Modelo propuesto rechazado: ${propuesta.brand_name} ${propuesta.name}${text(nota) ? ` (${text(nota)})` : ''}`;
    for (const u of unidades) await this.evento(Number(u.unit_id), titulo, caller_user);
    return { statusCode: STATUS_CODES.OK, message: destino ? `Fusionado con ${destino.brand_name} ${destino.name}` : 'Propuesta rechazada' };
  };

  quitarUnidad = async ({ unit_id, caller_user, caller_profile, caller_user_id }) => {
    if (!unit_id) throw badRequest("Campo requerido: 'unit_id'");
    await this.dbmsReady;
    await assertUnitAccess(this.dbms, { caller_profile, caller_user_id, unit_id });
    await this.query('fleetSetUnitModel', { unit_id, model_id: null, version_id: null });
    await this.evento(unit_id, 'Modelo del catálogo quitado', caller_user);
    return { statusCode: STATUS_CODES.OK, message: 'Unidad desvinculada del modelo' };
  };
}

export default Catalogo;
