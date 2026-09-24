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

    const [livianaResult, pesadaResult] = await Promise.all([
      this.dbms.executeNamedQuery({ nameQuery: 'getFuelSummaryLiviana', params: { from, to: toEndOfDay } }),
      this.dbms.executeNamedQuery({ nameQuery: 'getFuelSummaryPesada', params: { from, to: toEndOfDay } }),
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
    totals.liviana.liters = +totals.liviana.liters.toFixed(2);
    totals.liviana.amount = +totals.liviana.amount.toFixed(2);
    totals.pesada.gallons = +totals.pesada.gallons.toFixed(2);
    totals.pesada.liters_equivalent = +totals.pesada.liters_equivalent.toFixed(2);

    return { statusCode: STATUS_CODES.OK, data: { from, to, totals, byVehicle } };
  };
}

export default Reporte;
