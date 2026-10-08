import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import { generateFuelTransactionNo } from './fuelTransactionNo.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Combustible > Transferencias (064_fuel_transfer.sql, Julio 07/10/2026).
// Una unidad le pasa combustible a otra que no puede ir a la estación (ej.
// montacargas a gasolina). Origen y destino son cualquier unidad. Tiene su
// Transaction ID FP-{AA}TR{MM}{DD}{###}; en Reportes los litros y el costo
// se restan del origen y se suman al destino. Costo = litros x precio por
// litro (por defecto el de la última carga con monto del origen).

const err = (statusCode, message) => new Error(JSON.stringify({ message, statusCode }));
const bad = (m) => err(STATUS_CODES.BAD_REQUEST, m);

const num = (v, label, { required = false, positive = false } = {}) => {
  if (v === undefined || v === null || String(v).trim() === '') {
    if (required) throw bad(`${label} es obligatorio.`);
    return null;
  }
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || (positive && n <= 0)) throw bad(`${label} debe ser un número ${positive ? 'mayor a 0' : 'mayor o igual a 0'}.`);
  return n;
};
const txt = (v, max) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));

class Transferencia {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  query = async (nameQuery, params = {}) => {
    await this.dbmsReady;
    return (await this.dbms.executeNamedQuery({ nameQuery, params }))?.rows || [];
  };

  lastPrice = async (vehicle_id) => {
    const [r] = await this.query('getLastFuelUnitPrice', { vehicle_id: Number(vehicle_id) });
    return r ? Number(r.unit_price) : null;
  };

  // Valida y arma los campos comunes de crear/editar.
  build = async ({ from_vehicle_id, to_vehicle_id, liters, unit_price_usd, measurement_value, measurement_type, responsible_id, notes }) => {
    if (!from_vehicle_id) throw bad('Elige la unidad que entrega el combustible (origen).');
    if (!to_vehicle_id) throw bad('Elige la unidad que lo recibe (destino).');
    if (Number(from_vehicle_id) === Number(to_vehicle_id)) throw bad('El origen y el destino deben ser unidades distintas.');
    const units = await Promise.all([from_vehicle_id, to_vehicle_id].map((id) => this.query('mntGetUnit', { id: Number(id) })));
    if (units.some(([u]) => !u || u.deleted_at)) throw err(STATUS_CODES.NOT_FOUND, 'Una de las unidades no existe o fue dada de baja.');
    const litros = num(liters, 'Los litros', { required: true, positive: true });
    let precio = num(unit_price_usd, 'El precio por litro');
    if (precio === null) precio = await this.lastPrice(from_vehicle_id);
    const lectura = num(measurement_value, 'La lectura');
    const tipo = measurement_type ? String(measurement_type).toLowerCase() : null;
    if (lectura !== null && !['km', 'horas'].includes(tipo)) throw bad('Indica si la lectura es en km u horas.');
    return {
      from_vehicle_id: Number(from_vehicle_id), to_vehicle_id: Number(to_vehicle_id),
      liters: String(litros),
      unit_price_usd: precio === null ? null : String(precio),
      amount: precio === null ? null : String(Math.round(litros * precio * 100) / 100),
      measurement_value: lectura === null ? null : String(lectura), measurement_type: lectura === null ? null : tipo,
      responsible_id: responsible_id ? Number(responsible_id) : null,
      notes: txt(notes, 2000),
    };
  };

  createTransferencia = async ({ filled_at, caller_user_id, ...campos }) => {
    const data = await this.build(campos);
    const fecha = filled_at || new Date().toISOString();
    if (Number.isNaN(new Date(fecha).getTime())) throw bad('Fecha y hora inválidas.');
    if (new Date(fecha) > new Date(Date.now() + 36 * 3600 * 1000)) throw bad('La fecha no puede ser futura.');
    await this.dbmsReady;
    const transaction_no = await generateFuelTransactionNo({ dbms: this.dbms, filled_at: fecha, fleetCode: 'TR' });
    const [{ id }] = await this.query('createTransferencia', {
      transaction_no, filled_at: new Date(fecha).toISOString(), fuel_type: 'gasolina', created_by: caller_user_id ? Number(caller_user_id) : null, ...data,
    });
    const [row] = await this.query('getTransferenciaById', { id: Number(id) });
    return { statusCode: STATUS_CODES.CREATED, data: row, message: `Transferencia ${transaction_no} registrada` };
  };

  getAllTransferencias = async () => ({ statusCode: STATUS_CODES.OK, data: await this.query('getAllTransferencias') });

  getTransferenciaById = async ({ id }) => {
    if (!id) throw bad("Campo requerido: 'id'");
    const [row] = await this.query('getTransferenciaById', { id: Number(id) });
    if (!row) throw err(STATUS_CODES.NOT_FOUND, `Transferencia ${id} no encontrada.`);
    return { statusCode: STATUS_CODES.OK, data: row };
  };

  updateTransferencia = async ({ id, ...campos }) => {
    if (!id) throw bad("Campo requerido: 'id'");
    const data = await this.build(campos);
    const r = await this.query('updateTransferencia', { id: Number(id), ...data });
    if (!r.length) throw err(STATUS_CODES.NOT_FOUND, `Transferencia ${id} no encontrada.`);
    const [row] = await this.query('getTransferenciaById', { id: Number(id) });
    return { statusCode: STATUS_CODES.OK, data: row, message: 'Transferencia actualizada' };
  };

  deleteTransferencia = async ({ id }) => {
    if (!id) throw bad("Campo requerido: 'id'");
    const r = await this.query('deleteTransferencia', { id: Number(id) });
    if (!r.length) throw err(STATUS_CODES.NOT_FOUND, `Transferencia ${id} no encontrada.`);
    return { statusCode: STATUS_CODES.OK, data: r[0], message: `Transferencia ${r[0].transaction_no} eliminada` };
  };

  // Precio por defecto al elegir el origen en el formulario.
  getPrecioTransferencia = async ({ vehicle_id }) => {
    if (!vehicle_id) throw bad("Campo requerido: 'vehicle_id'");
    return { statusCode: STATUS_CODES.OK, data: { unit_price: await this.lastPrice(vehicle_id) } };
  };
}

export default Transferencia;
