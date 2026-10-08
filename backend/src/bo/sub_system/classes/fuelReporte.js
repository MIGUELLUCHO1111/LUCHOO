import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

const GALLONS_TO_LITERS = 3.78541;

// Resumen de combustible para Reportes (fase 1 — solo lo que ya tiene datos
// reales: litros/galones/dólares de Liviana y Pesada). La agregación vive
// detrás de este único método: el día que haga falta pre-agregar en una
// tabla de resumen, cambia la implementación interna, no el contrato que
// consume el frontend.
//
// El gasto en dólares SOLO aplica a Liviana (compra por transacción en
// estación) — Pesada descuenta del tanque propio, no hay transacción en
// dólares por carga (ver ROADMAP_REPORTES.md).
//
// Transferencias (064, 07/10/2026): una unidad le pasa gasolina a otra
// (ej. montacargas a gasolina). En el rango, los litros y el costo se
// restan del origen y se suman al destino. Si el destino es de flota
// pesada, esa gasolina va aparte de sus galones de gasoil
// (gasolina_liters) y cuenta en los litros equivalentes de Pesada.
class Reporte {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  getFuelSummary = async ({ from, to }) => {
    await this.dbmsReady;

    if (!from || !to) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'from', 'to'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    // 'to' llega como fecha (YYYY-MM-DD); se extiende al final del día para
    // no excluir llenados que ocurrieron después de medianoche de ese día.
    const toEndOfDay = /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59.999` : to;

    const [livianaResult, pesadaResult, transferResult] = await Promise.all([
      this.dbms.executeNamedQuery({ nameQuery: 'getFuelSummaryLiviana', params: { from, to: toEndOfDay } }),
      this.dbms.executeNamedQuery({ nameQuery: 'getFuelSummaryPesada', params: { from, to: toEndOfDay } }),
      this.dbms.executeNamedQuery({ nameQuery: 'getFuelSummaryTransfers', params: { from, to: toEndOfDay } }),
    ]);

    const livianaRows = livianaResult?.rows || [];
    const pesadaRows = pesadaResult?.rows || [];

    const byVehicle = [
      ...livianaRows.map((r) => ({
        vehicle_id: r.vehicle_id,
        code: r.code,
        name: r.name,
        fleet_type: 'liviana',
        liters: parseFloat(r.liters) || 0,
        gallons: null,
        amount: parseFloat(r.amount) || 0,
        count: parseInt(r.count, 10) || 0,
      })),
      ...pesadaRows.map((r) => {
        const gallons = parseFloat(r.gallons) || 0;
        return {
          vehicle_id: r.vehicle_id,
          code: r.code,
          name: r.name,
          fleet_type: 'pesada',
          liters: null,
          gallons,
          liters_equivalent: +(gallons * GALLONS_TO_LITERS).toFixed(2),
          amount: null,
          count: parseInt(r.count, 10) || 0,
        };
      }),
    ];

    // ---------- Transferencias: mover litros y costo del origen al destino ----------
    const transferRows = transferResult?.rows || [];
    const byId = new Map(byVehicle.map((v) => [String(v.vehicle_id), v]));
    const ensure = (id, code, name, fleet) => {
      const key = String(id);
      if (!byId.has(key)) {
        const row = fleet === 'pesada'
          ? { vehicle_id: id, code, name, fleet_type: 'pesada', liters: null, gallons: 0, liters_equivalent: 0, amount: null, count: 0 }
          : { vehicle_id: id, code, name, fleet_type: 'liviana', liters: 0, gallons: null, amount: 0, count: 0 };
        byVehicle.push(row);
        byId.set(key, row);
      }
      const row = byId.get(key);
      row.transfer_out_liters = row.transfer_out_liters || 0;
      row.transfer_in_liters = row.transfer_in_liters || 0;
      row.transfer_out_amount = row.transfer_out_amount || 0;
      row.transfer_in_amount = row.transfer_in_amount || 0;
      return row;
    };
    for (const t of transferRows) {
      const liters = parseFloat(t.liters) || 0;
      const amount = parseFloat(t.amount) || 0;
      const out = ensure(t.from_vehicle_id, t.from_code, t.from_name, t.from_fleet);
      out.transfer_out_liters += liters;
      out.transfer_out_amount += amount;
      const inn = ensure(t.to_vehicle_id, t.to_code, t.to_name, t.to_fleet);
      inn.transfer_in_liters += liters;
      inn.transfer_in_amount += amount;
    }
    for (const v of byVehicle) {
      if (v.transfer_out_liters === undefined) continue;
      const netLiters = v.transfer_in_liters - v.transfer_out_liters;
      const netAmount = v.transfer_in_amount - v.transfer_out_amount;
      if (v.fleet_type === 'liviana') {
        v.liters = +((v.liters || 0) + netLiters).toFixed(2);
        v.amount = +((v.amount || 0) + netAmount).toFixed(2);
      } else {
        v.gasolina_liters = +netLiters.toFixed(2);
        v.amount = netAmount ? +netAmount.toFixed(2) : null;
      }
      for (const k of ['transfer_out_liters', 'transfer_in_liters', 'transfer_out_amount', 'transfer_in_amount']) v[k] = +v[k].toFixed(2);
    }

    const totals = {
      liviana: livianaRows.reduce(
        (acc, r) => ({
          liters: acc.liters + (parseFloat(r.liters) || 0),
          amount: acc.amount + (parseFloat(r.amount) || 0),
          count: acc.count + (parseInt(r.count, 10) || 0),
        }),
        { liters: 0, amount: 0, count: 0 },
      ),
      pesada: pesadaRows.reduce(
        (acc, r) => {
          const gallons = parseFloat(r.gallons) || 0;
          return {
            gallons: acc.gallons + gallons,
            liters_equivalent: acc.liters_equivalent + gallons * GALLONS_TO_LITERS,
            count: acc.count + (parseInt(r.count, 10) || 0),
          };
        },
        { gallons: 0, liters_equivalent: 0, count: 0 },
      ),
    };
    // Transferencias entre flotas: lo que sale de Liviana hacia Pesada (o al revés).
    for (const t of transferRows) {
      const liters = parseFloat(t.liters) || 0;
      const amount = parseFloat(t.amount) || 0;
      if (t.from_fleet === t.to_fleet) continue;
      if (t.from_fleet === 'liviana') { totals.liviana.liters -= liters; totals.liviana.amount -= amount; }
      if (t.to_fleet === 'liviana') { totals.liviana.liters += liters; totals.liviana.amount += amount; }
      if (t.to_fleet === 'pesada') { totals.pesada.liters_equivalent += liters; totals.pesada.gasolina_liters = (totals.pesada.gasolina_liters || 0) + liters; totals.pesada.amount = (totals.pesada.amount || 0) + amount; }
      if (t.from_fleet === 'pesada') { totals.pesada.liters_equivalent -= liters; totals.pesada.gasolina_liters = (totals.pesada.gasolina_liters || 0) - liters; totals.pesada.amount = (totals.pesada.amount || 0) - amount; }
    }
    totals.transferencias = {
      count: transferRows.length,
      liters: +transferRows.reduce((a, t) => a + (parseFloat(t.liters) || 0), 0).toFixed(2),
      amount: +transferRows.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0).toFixed(2),
    };
    if (totals.pesada.gasolina_liters !== undefined) totals.pesada.gasolina_liters = +totals.pesada.gasolina_liters.toFixed(2);
    if (totals.pesada.amount !== undefined) totals.pesada.amount = +totals.pesada.amount.toFixed(2);
    totals.liviana.liters = +totals.liviana.liters.toFixed(2);
    totals.liviana.amount = +totals.liviana.amount.toFixed(2);
    totals.pesada.gallons = +totals.pesada.gallons.toFixed(2);
    totals.pesada.liters_equivalent = +totals.pesada.liters_equivalent.toFixed(2);

    return { statusCode: STATUS_CODES.OK, data: { from, to, totals, byVehicle } };
  };
}

export default Reporte;
