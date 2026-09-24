import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import { getAccessibleProjectIds } from './projectAccess.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Resumen de Control de Horas para Reportes (fase 1 -- solo horas, sin
// tarifas $/hora todavía: no existen en el sistema, así que no se inventa
// ningún monto. La rentabilidad en dólares queda pendiente para cuando
// haya tarifas, igual que Pesada en Combustible no tiene monto porque usa
// tanque propio (ver ROADMAP_HORAS_RENTABILIDAD.md).
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
        pct_standby: hrsTotales > 0 ? +((standby * 100) / hrsTotales).toFixed(2) : null,
        dias_registrados: parseInt(r.dias_registrados, 10) || 0,
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
        });
      }
      const acc = byProyectoMap.get(eq.project_id);
      acc.cobro_completo += eq.cobro_completo;
      acc.standby += eq.standby;
      acc.hrs_totales += eq.hrs_totales;
      acc.equipos_activos += 1;
    }
    const byProyecto = [...byProyectoMap.values()].map((p) => ({
      ...p,
      cobro_completo: +p.cobro_completo.toFixed(2),
      standby: +p.standby.toFixed(2),
      hrs_totales: +p.hrs_totales.toFixed(2),
      pct_standby: p.hrs_totales > 0 ? +((p.standby * 100) / p.hrs_totales).toFixed(2) : null,
    }));

    const totals = byEquipo.reduce(
      (acc, eq) => ({
        cobro_completo: acc.cobro_completo + eq.cobro_completo,
        standby: acc.standby + eq.standby,
        hrs_totales: acc.hrs_totales + eq.hrs_totales,
      }),
      { cobro_completo: 0, standby: 0, hrs_totales: 0 },
    );
    totals.cobro_completo = +totals.cobro_completo.toFixed(2);
    totals.standby = +totals.standby.toFixed(2);
    totals.hrs_totales = +totals.hrs_totales.toFixed(2);
    totals.pct_standby = totals.hrs_totales > 0 ? +((totals.standby * 100) / totals.hrs_totales).toFixed(2) : null;

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

    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getResumenHorasPorDia',
      params: { from, to },
    });

    const accessibleIds = await getAccessibleProjectIds(this.dbms, caller_profile);
    const porDiaMap = new Map();

    for (const r of result?.rows || []) {
      const fecha = new Date(r.fecha).toISOString().slice(0, 10);
      if (!porDiaMap.has(fecha)) {
        porDiaMap.set(fecha, { fecha, cobro_completo: 0, standby: 0, hrs_totales: 0 });
      }
      // r.project_id es null en los días sin ningún registro (LEFT JOIN) --
      // esas filas no aportan nada, solo garantizan que el día aparezca.
      if (r.project_id != null && (!accessibleIds || accessibleIds.map(Number).includes(Number(r.project_id)))) {
        const acc = porDiaMap.get(fecha);
        acc.cobro_completo += parseFloat(r.cobro_completo) || 0;
        acc.standby += parseFloat(r.standby) || 0;
        acc.hrs_totales += parseFloat(r.hrs_totales) || 0;
      }
    }

    const porDia = [...porDiaMap.values()]
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      .map((d) => ({
        fecha: d.fecha,
        cobro_completo: +d.cobro_completo.toFixed(2),
        standby: +d.standby.toFixed(2),
        hrs_totales: +d.hrs_totales.toFixed(2),
        pct_standby: d.hrs_totales > 0 ? +((d.standby * 100) / d.hrs_totales).toFixed(2) : null,
      }));

    return { statusCode: STATUS_CODES.OK, data: { from, to, porDia } };
  };
}

export default Reporte;
