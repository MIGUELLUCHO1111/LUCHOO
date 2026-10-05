import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import { getAccessibleProjectIds } from './projectAccess.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// %Stand-By agregado con la fórmula de la hoja "Gráfico" del Excel de
// referencia: (1 - cobro completo / hrs. totales) * 100. A diferencia de
// standby/hrs_totales, cuenta como stand-by TODA hora contratada que no se
// cobró completa (incluye horas fuera de servicio). Se acota en 0: si un
// equipo trabajó más de lo contratado no hay stand-by negativo.
// (Julio, 25/09/2026 -- pedido explícito de usar la fórmula del Excel.)
const pctStandby = (cobroCompleto, hrsTotales) =>
  hrsTotales > 0 ? +Math.max(0, (1 - cobroCompleto / hrsTotales) * 100).toFixed(2) : null;

// Resumen de Control de Horas para Reportes, con el monto generado según la
// tarifa USD/hora de cada unidad en su proyecto (project_equipment_rate, 057):
//   generado = cobro completo x tarifa + stand-by x tarifa SB.
// Una unidad sin tarifa cargada no suma monto y se marca con sin_tarifa.
const money = (n) => +(Number(n) || 0).toFixed(2);

class Reporte {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  getResumenHoras = async ({ from, to, caller_profile }) => {
    await this.dbmsReady;

    if (!from || !to) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'from', 'to'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getResumenHorasPorEquipo',
      params: { from, to },
    });

    const accessibleIds = await getAccessibleProjectIds(this.dbms, caller_profile);
    const rows = (result?.rows || []).filter(
      (r) => !accessibleIds || accessibleIds.map(Number).includes(Number(r.project_id)),
    );

    const byEquipo = rows.map((r) => {
      const cobroCompleto = parseFloat(r.cobro_completo) || 0;
      const standby = parseFloat(r.standby) || 0;
      const hrsTotales = parseFloat(r.hrs_totales) || 0;
      const rate = r.rate_usd == null ? null : parseFloat(r.rate_usd);
      const standbyRate = r.standby_rate_usd == null ? null : parseFloat(r.standby_rate_usd);
      const generadoCobro = rate === null ? 0 : cobroCompleto * rate;
      const generadoStandby = rate === null || standbyRate === null ? 0 : standby * standbyRate;
      return {
        project_id: r.project_id,
        project_name: r.project_name,
        company_name: r.company_name,
        equipment_id: r.equipment_id,
        code: r.equipment_code,
        name: r.equipment_name,
        cobro_completo: +cobroCompleto.toFixed(2),
        standby: +standby.toFixed(2),
        hrs_totales: +hrsTotales.toFixed(2),
        pct_standby: pctStandby(cobroCompleto, hrsTotales),
        dias_registrados: parseInt(r.dias_registrados, 10) || 0,
        rate_usd: rate,
        standby_rate_usd: standbyRate,
        sin_tarifa: rate === null,
        generado_cobro: money(generadoCobro),
        generado_standby: money(generadoStandby),
        generado_usd: money(generadoCobro + generadoStandby),
      };
    });

    const byProyectoMap = new Map();
    for (const eq of byEquipo) {
      if (!byProyectoMap.has(eq.project_id)) {
        byProyectoMap.set(eq.project_id, {
          project_id: eq.project_id,
          project_name: eq.project_name,
          company_name: eq.company_name,
          cobro_completo: 0,
          standby: 0,
          hrs_totales: 0,
          equipos_activos: 0,
          generado_usd: 0,
          equipos_sin_tarifa: 0,
        });
      }
      const acc = byProyectoMap.get(eq.project_id);
      acc.cobro_completo += eq.cobro_completo;
      acc.standby += eq.standby;
      acc.hrs_totales += eq.hrs_totales;
      acc.equipos_activos += 1;
      acc.generado_usd += eq.generado_usd;
      if (eq.sin_tarifa) acc.equipos_sin_tarifa += 1;
    }
    const byProyecto = [...byProyectoMap.values()].map((p) => ({
      ...p,
      cobro_completo: +p.cobro_completo.toFixed(2),
      standby: +p.standby.toFixed(2),
      hrs_totales: +p.hrs_totales.toFixed(2),
      pct_standby: pctStandby(p.cobro_completo, p.hrs_totales),
      generado_usd: money(p.generado_usd),
    }));

    const totals = byEquipo.reduce(
      (acc, eq) => ({
        cobro_completo: acc.cobro_completo + eq.cobro_completo,
        standby: acc.standby + eq.standby,
        hrs_totales: acc.hrs_totales + eq.hrs_totales,
        generado_cobro: acc.generado_cobro + eq.generado_cobro,
        generado_standby: acc.generado_standby + eq.generado_standby,
        equipos_sin_tarifa: acc.equipos_sin_tarifa + (eq.sin_tarifa ? 1 : 0),
      }),
      { cobro_completo: 0, standby: 0, hrs_totales: 0, generado_cobro: 0, generado_standby: 0, equipos_sin_tarifa: 0 },
    );
    totals.cobro_completo = +totals.cobro_completo.toFixed(2);
    totals.standby = +totals.standby.toFixed(2);
    totals.hrs_totales = +totals.hrs_totales.toFixed(2);
    totals.pct_standby = pctStandby(totals.cobro_completo, totals.hrs_totales);
    totals.generado_cobro = money(totals.generado_cobro);
    totals.generado_standby = money(totals.generado_standby);
    totals.generado_usd = money(totals.generado_cobro + totals.generado_standby);

    return { statusCode: STATUS_CODES.OK, data: { from, to, totals, byProyecto, byEquipo } };
  };

  // Un renglón por día del rango (con 0 en los días sin datos) -- equivale
  // a la hoja "Gráfico Agosto" del Excel de referencia, sumando todos los
  // proyectos que el perfil que llama puede ver.
  getResumenPorDia = async ({ from, to, caller_profile }) => {
    await this.dbmsReady;

    if (!from || !to) {
      throw new Error(JSON.stringify({
        message: "Campos requeridos: 'from', 'to'",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }

    const [result, ptoResult] = await Promise.all([
      this.dbms.executeNamedQuery({ nameQuery: 'getResumenHorasPorDia', params: { from, to } }),
      this.dbms.executeNamedQuery({ nameQuery: 'getPtoPorDia', params: { from, to } }),
    ]);

    const accessibleIds = await getAccessibleProjectIds(this.dbms, caller_profile);
    const canSee = (projectId) => !accessibleIds || accessibleIds.map(Number).includes(Number(projectId));
    const porDiaMap = new Map();

    for (const r of result?.rows || []) {
      const fecha = new Date(r.fecha).toISOString().slice(0, 10);
      if (!porDiaMap.has(fecha)) {
        porDiaMap.set(fecha, { fecha, cobro_completo: 0, standby: 0, hrs_totales: 0, horas_pto: null, generado_usd: 0 });
      }
      // r.project_id es null en los días sin ningún registro (LEFT JOIN) --
      // esas filas no aportan nada, solo garantizan que el día aparezca.
      if (r.project_id != null && canSee(r.project_id)) {
        const acc = porDiaMap.get(fecha);
        acc.cobro_completo += parseFloat(r.cobro_completo) || 0;
        acc.standby += parseFloat(r.standby) || 0;
        acc.hrs_totales += parseFloat(r.hrs_totales) || 0;
        acc.generado_usd += parseFloat(r.generado_usd) || 0;
      }
    }

    // Horas PTO (fila fija del Excel): null si ningún proyecto visible la
    // cargó ese día, para que el gráfico deje el hueco en vez de marcar 0.
    for (const r of ptoResult?.rows || []) {
      const fecha = new Date(r.fecha).toISOString().slice(0, 10);
      const acc = porDiaMap.get(fecha);
      if (acc && canSee(r.project_id)) acc.horas_pto = (acc.horas_pto || 0) + (parseFloat(r.horas_pto) || 0);
    }

    const porDia = [...porDiaMap.values()]
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      .map((d) => ({
        fecha: d.fecha,
        cobro_completo: +d.cobro_completo.toFixed(2),
        standby: +d.standby.toFixed(2),
        hrs_totales: +d.hrs_totales.toFixed(2),
        pct_standby: pctStandby(d.cobro_completo, d.hrs_totales),
        horas_pto: d.horas_pto === null ? null : +d.horas_pto.toFixed(2),
        generado_usd: money(d.generado_usd),
      }));

    return { statusCode: STATUS_CODES.OK, data: { from, to, porDia } };
  };
}

export default Reporte;
