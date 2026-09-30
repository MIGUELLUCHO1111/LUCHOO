import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';

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

  listar = async () => {
    const [modelos, marcas, familias] = await Promise.all([this.query('fleetCatalogModels'), this.query('fleetCatalogBrands'), this.query('fleetListFamilies')]);
    return { statusCode: STATUS_CODES.OK, data: { modelos, marcas, familias } };
  };

  guardarModelo = async ({ id, brand_name, name, category, body_type, capacity, fuel_type, meter_type, description, versions }) => {
    const marca = text(brand_name);
    const modelo = text(name);
    if (!marca || !modelo) throw badRequest("Campos requeridos: 'brand_name' y 'name'");

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
  guardarFamilia = async ({ code, name, art }) => {
    const codigo = String(code || '').trim().toUpperCase();
    const nombre = text(name);
    if (!/^[A-Z0-9]{1,10}$/.test(codigo)) throw badRequest('El código de la familia debe tener de 1 a 10 letras o números (ej. GT, CBA)');
    if (!nombre) throw badRequest("Campo requerido: 'name'");
    const [row] = await this.query('fleetUpsertFamily', { code: codigo, name: nombre, art: ARTS.includes(art) ? art : 'truck' });
    return { statusCode: STATUS_CODES.OK, data: row, message: 'Familia guardada' };
  };

  eliminarFamilia = async ({ code }) => {
    const codigo = String(code || '').trim().toUpperCase();
    const [{ n } = { n: 0 }] = await this.query('fleetCountFamilyModels', { code: codigo });
    if (n > 0) {
      throw new Error(JSON.stringify({ message: `No se puede eliminar: ${n} modelo${n === 1 ? '' : 's'} usa${n === 1 ? '' : 'n'} esta familia. Cámbialos de familia primero.`, statusCode: STATUS_CODES.CONFLICT }));
    }
    const [row] = await this.query('fleetDeleteFamily', { code: codigo });
    if (!row) throw notFound(`Familia ${codigo} no encontrada`);
    return { statusCode: STATUS_CODES.OK, message: `Familia ${row.name} eliminada` };
  };

  archivarModelo = async ({ id }) => {
    if (!id) throw badRequest("Campo requerido: 'id'");
    const [row] = await this.query('fleetArchiveModel', { id });
    if (!row) throw notFound(`Modelo con id ${id} no encontrado`);
    return { statusCode: STATUS_CODES.OK, message: `Modelo "${row.name}" archivado` };
  };

  // Asocia varias unidades a un modelo (y opcionalmente a una version).
  asignarUnidades = async ({ model_id, unit_ids, version_id, caller_user }) => {
    if (!model_id || !Array.isArray(unit_ids) || !unit_ids.length) throw badRequest("Campos requeridos: 'model_id' y 'unit_ids'");
    const [modelo] = await this.query('fleetGetModel', { id: model_id });
    if (!modelo || modelo.archived_at) throw notFound(`Modelo con id ${model_id} no encontrado`);
    for (const unitId of unit_ids.map(Number).filter(Number.isInteger)) {
      await this.query('fleetSetUnitModel', { unit_id: unitId, model_id: String(model_id), version_id: version_id ? String(version_id) : null });
      await this.evento(unitId, `Modelo asignado: ${modelo.brand_name} ${modelo.name}`, caller_user);
    }
    return { statusCode: STATUS_CODES.OK, message: 'Unidades asociadas al modelo' };
  };

  quitarUnidad = async ({ unit_id, caller_user }) => {
    if (!unit_id) throw badRequest("Campo requerido: 'unit_id'");
    await this.query('fleetSetUnitModel', { unit_id, model_id: null, version_id: null });
    await this.evento(unit_id, 'Modelo del catálogo quitado', caller_user);
    return { statusCode: STATUS_CODES.OK, message: 'Unidad desvinculada del modelo' };
  };
}

export default Catalogo;
