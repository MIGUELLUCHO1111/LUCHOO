import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Donut } from "@/components/ui/donut";
import { HorasPorDiaChart } from "@/components/ui/horasPorDiaChart";
import { PageLayout } from "@/components/layout/PageLayout";
import { hoursService } from "@/services";
import { veTodayISO, formatFechaISO } from "@/lib/trackerFormat";
import { PALETTE, useReportRange, ReportRangeFilter } from "./reportShared";

// Montos en USD con separadores venezolanos (1.234,56).
const usd = (n) =>
  `${(Number(n) || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const HoursReports = () => {
  const [horasSummary, setHorasSummary] = useState(null);
  const [horasLoading, setHorasLoading] = useState(true);
  const [horasError, setHorasError] = useState(null);

  const [porDia, setPorDia] = useState([]);
  const [porDiaLoading, setPorDiaLoading] = useState(true);
  const [porDiaError, setPorDiaError] = useState(null);

  // ---------- Detalle de un día específico, por equipo (solo lectura) ----------
  const [detalleCompanies, setDetalleCompanies] = useState([]);
  const [detalleProjects, setDetalleProjects] = useState([]);
  const [detalleCompanyId, setDetalleCompanyId] = useState("");
  const [detalleProjectId, setDetalleProjectId] = useState("");
  const [detalleFecha, setDetalleFecha] = useState(veTodayISO());
  const [detalleRows, setDetalleRows] = useState([]);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalleError, setDetalleError] = useState(null);

  const range = useReportRange(async (from, to) => {
    setHorasLoading(true);
    setHorasError(null);
    setPorDiaLoading(true);
    setPorDiaError(null);

    try {
      setHorasSummary(await hoursService.getResumenHoras({ from, to }));
    } catch (err) {
      console.error("Error cargando resumen de horas:", err);
      setHorasError("No se pudo cargar el resumen de Control de Horas.");
    } finally {
      setHorasLoading(false);
    }

    try {
      const res = await hoursService.getResumenPorDia({ from, to });
      setPorDia(Array.isArray(res?.porDia) ? res.porDia : []);
    } catch (err) {
      console.error("Error cargando el resumen por día:", err);
      setPorDiaError("No se pudo cargar el resumen día por día.");
    } finally {
      setPorDiaLoading(false);
    }
  });

  useEffect(() => {
    hoursService.getAllEmpresas().then((res) => setDetalleCompanies(Array.isArray(res) ? res : []));
  }, []);

  useEffect(() => {
    if (!detalleCompanyId) {
      setDetalleProjects([]);
      setDetalleProjectId("");
      return;
    }
    hoursService.getProyectosByEmpresa(Number(detalleCompanyId)).then((res) => {
      setDetalleProjects(Array.isArray(res) ? res : []);
    });
  }, [detalleCompanyId]);

  useEffect(() => {
    if (!detalleProjectId || !detalleFecha) {
      setDetalleRows([]);
      return;
    }
    setDetalleLoading(true);
    setDetalleError(null);
    hoursService
      .getRegistrosDelDia({ project_id: Number(detalleProjectId), fecha: detalleFecha })
      .then((res) => setDetalleRows(Array.isArray(res) ? res : []))
      .catch((err) => {
        console.error("Error cargando el detalle del día:", err);
        setDetalleError(err.response?.data?.message || err.message || "Error al cargar el día");
      })
      .finally(() => setDetalleLoading(false));
  }, [detalleProjectId, detalleFecha]);

  // ---------- Dona: Control de Horas -- cobro completo vs stand-by ----------
  const horasTotals = horasSummary?.totals || { cobro_completo: 0, standby: 0, hrs_totales: 0, pct_standby: null, generado_usd: 0, generado_cobro: 0, generado_standby: 0, equipos_sin_tarifa: 0 };
  const horasByProyecto = horasSummary?.byProyecto || [];
  const horasByEquipo = horasSummary?.byEquipo || [];
  const horasSegments = [
    { label: "Cobro Completo", value: horasTotals.cobro_completo, color: PALETTE[4] },
    { label: "Stand-By", value: horasTotals.standby, color: PALETTE[5] },
  ].filter((s) => s.value > 0);
  const horasTotalHrs = horasTotals.cobro_completo + horasTotals.standby;

  return (
    <PageLayout icon={Clock} title="Reportes de Control de Horas" maxWidth="max-w-7xl">
      <div className="flex flex-col gap-8">
        <ReportRangeFilter range={range} />

        {/* ---------- Monto generado según la tarifa de cada unidad ---------- */}
        <Card className="w-full">
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Generado (USD)</span>
              <span className="text-3xl font-display text-slate-900 dark:text-white tabular-nums">
                {horasLoading ? "…" : usd(horasTotals.generado_usd)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Por cobro completo</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                {horasLoading ? "…" : usd(horasTotals.generado_cobro)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Por stand-by</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                {horasLoading ? "…" : usd(horasTotals.generado_standby)}
              </span>
            </div>
            <p className="sm:col-span-3 text-[11px] text-slate-400">
              Horas de cobro completo × tarifa por hora + horas stand-by × tarifa SB de cada unidad. Las tarifas se
              cargan en Control de Horas › Proyectos › Tarifas por hora.
              {!horasLoading && horasTotals.equipos_sin_tarifa > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  {" "}{horasTotals.equipos_sin_tarifa} {horasTotals.equipos_sin_tarifa === 1 ? "unidad no tiene" : "unidades no tienen"} tarifa y no suman monto.
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* ---------- Control de Horas: cobro completo vs stand-by ---------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start justify-items-center">
          <div className="w-full max-w-lg flex flex-col items-center gap-4">
            <h3 className="text-sm font-display uppercase tracking-widest text-slate-900 dark:text-white">
              Cobro Completo vs Stand-By
            </h3>
            <Card className="w-full">
              <CardContent className="p-8 flex flex-col items-center gap-6">
                {horasLoading ? (
                  <p className="text-sm text-slate-400 py-8">Cargando...</p>
                ) : horasSegments.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8">Sin registros de horas en este rango</p>
                ) : (
                  <>
                    <Donut segments={horasSegments} centerLabel="Horas" centerValue={Math.round(horasTotalHrs)} />
                    <ul className="w-full space-y-2">
                      {horasSegments.map((s, i) => (
                        <li key={i} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.label}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">{s.value.toFixed(2)} h</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {horasError && <p className="text-sm text-red-500">{horasError}</p>}
                <p className="text-[11px] text-slate-400 text-center">
                  Suma de todos los proyectos de Control de Horas en el rango de fechas. %Stand-By total: {horasTotals.pct_standby === null ? "-" : `${horasTotals.pct_standby}%`}.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="w-full max-w-lg flex flex-col items-center gap-4">
            <h3 className="text-sm font-display uppercase tracking-widest text-slate-900 dark:text-white">
              Horas por Proyecto
            </h3>
            <Card className="w-full overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Cobro Completo</TableHead>
                    <TableHead>Stand-By</TableHead>
                    <TableHead>% Stand-By</TableHead>
                    <TableHead>Generado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {horasLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : horasByProyecto.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                        Sin registros en este rango
                      </TableCell>
                    </TableRow>
                  ) : (
                    horasByProyecto.map((p, i) => (
                      <TableRow key={p.project_id} className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                        <TableCell>
                          <div className="font-bold text-slate-900 dark:text-white">{p.project_name}</div>
                          <div className="text-xs text-slate-400">{p.company_name}</div>
                        </TableCell>
                        <TableCell className="font-bold text-slate-900 dark:text-white">{p.cobro_completo.toFixed(2)}</TableCell>
                        <TableCell>{p.standby.toFixed(2)}</TableCell>
                        <TableCell>{p.pct_standby === null ? "-" : `${p.pct_standby}%`}</TableCell>
                        <TableCell className="font-bold text-slate-900 dark:text-white tabular-nums">{usd(p.generado_usd)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>

        {/* ---------- Control de Horas: detalle por equipo ---------- */}
        <Card className="w-full overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipo</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead>Cobro Completo</TableHead>
                <TableHead>Stand-By</TableHead>
                <TableHead>% Stand-By</TableHead>
                <TableHead>Días Registrados</TableHead>
                <TableHead>Tarifa (Hora / SB)</TableHead>
                <TableHead>Generado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {horasLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : horasByEquipo.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    No hay registros de horas en este rango
                  </TableCell>
                </TableRow>
              ) : (
                horasByEquipo.map((eq, i) => (
                  <TableRow key={`${eq.project_id}-${eq.equipment_id}`} className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                    <TableCell className="font-mono font-bold text-slate-900 dark:text-white">{eq.code}</TableCell>
                    <TableCell>{eq.project_name}</TableCell>
                    <TableCell className="font-bold text-slate-900 dark:text-white">{eq.cobro_completo.toFixed(2)}</TableCell>
                    <TableCell>{eq.standby.toFixed(2)}</TableCell>
                    <TableCell>{eq.pct_standby === null ? "-" : `${eq.pct_standby}%`}</TableCell>
                    <TableCell>{eq.dias_registrados}</TableCell>
                    <TableCell className="tabular-nums">
                      {eq.sin_tarifa ? (
                        <span className="text-amber-600 dark:text-amber-400 text-xs font-bold">Sin tarifa</span>
                      ) : (
                        <>{usd(eq.rate_usd)} / {eq.standby_rate_usd === null ? "—" : usd(eq.standby_rate_usd)}</>
                      )}
                    </TableCell>
                    <TableCell className="font-bold text-slate-900 dark:text-white tabular-nums">{usd(eq.generado_usd)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* ---------- Control de Horas: resumen día por día (todos los días del rango) ---------- */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-display uppercase tracking-widest text-slate-900 dark:text-white">
            Resumen por Día
          </h3>
          {!porDiaLoading && !porDiaError && porDia.length > 0 && (
            <Card className="w-full">
              <CardContent className="p-5">
                <HorasPorDiaChart data={porDia} />
              </CardContent>
            </Card>
          )}
          <Card className="w-full overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Total Hrs. Cobro Completo</TableHead>
                    <TableHead>Total Hrs. Stand-By</TableHead>
                    <TableHead>% Stand-By</TableHead>
                    <TableHead>Hrs. Totales</TableHead>
                    <TableHead>Horas PTO</TableHead>
                    <TableHead>Generado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porDiaLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : porDiaError ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-red-500">
                        {porDiaError}
                      </TableCell>
                    </TableRow>
                  ) : porDia.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                        Sin días en este rango
                      </TableCell>
                    </TableRow>
                  ) : (
                    porDia.map((d, i) => (
                      <TableRow key={d.fecha} className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                        <TableCell className="font-bold text-slate-900 dark:text-white">{formatFechaISO(d.fecha)}</TableCell>
                        <TableCell>{d.cobro_completo.toFixed(2)}</TableCell>
                        <TableCell>{d.standby.toFixed(2)}</TableCell>
                        <TableCell>{d.pct_standby === null ? "-" : `${d.pct_standby}%`}</TableCell>
                        <TableCell>{d.hrs_totales.toFixed(2)}</TableCell>
                        <TableCell>{d.horas_pto === null ? "-" : d.horas_pto.toFixed(2)}</TableCell>
                        <TableCell className="font-bold text-slate-900 dark:text-white tabular-nums">{usd(d.generado_usd)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* ---------- Control de Horas: detalle de un día por equipo (solo lectura) ---------- */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-display uppercase tracking-widest text-slate-900 dark:text-white">
            Detalle de un Día
          </h3>
          <Card className="w-full">
            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-bold">Empresa</Label>
                  <select
                    value={detalleCompanyId}
                    onChange={(e) => { setDetalleCompanyId(e.target.value); setDetalleProjectId(""); }}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {detalleCompanies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-bold">Proyecto</Label>
                  <select
                    value={detalleProjectId}
                    onChange={(e) => setDetalleProjectId(e.target.value)}
                    disabled={!detalleCompanyId}
                    className={`px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm ${!detalleCompanyId ? "opacity-50" : ""}`}
                  >
                    <option value="">Seleccionar...</option>
                    {detalleProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-bold">Fecha</Label>
                  <Input type="date" value={detalleFecha} onChange={(e) => setDetalleFecha(e.target.value)} />
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipo</TableHead>
                      <TableHead>Ejecutadas</TableHead>
                      <TableHead>Horas Disponibles</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Stand-By</TableHead>
                      <TableHead>Hrs. Totales</TableHead>
                      <TableHead>% Stand-By</TableHead>
                      <TableHead>% Ejec.+Disp.</TableHead>
                      <TableHead>Nota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!detalleProjectId ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                          Selecciona empresa, proyecto y fecha para ver el detalle
                        </TableCell>
                      </TableRow>
                    ) : detalleLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                          Cargando...
                        </TableCell>
                      </TableRow>
                    ) : detalleError ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-red-500">
                          {detalleError}
                        </TableCell>
                      </TableRow>
                    ) : detalleRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                          Sin registros guardados ese día
                        </TableCell>
                      </TableRow>
                    ) : (
                      detalleRows.map((r, i) => (
                        <TableRow key={r.id} className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                          <TableCell className="font-mono font-bold text-slate-900 dark:text-white">{r.equipment_code}</TableCell>
                          <TableCell>{parseFloat(r.executed_hours).toFixed(2)}</TableCell>
                          <TableCell>{parseFloat(r.pto_hours).toFixed(2)}</TableCell>
                          <TableCell className="font-bold text-slate-900 dark:text-white">{parseFloat(r.total_hours).toFixed(2)}</TableCell>
                          <TableCell>{parseFloat(r.standby_hours).toFixed(2)}</TableCell>
                          <TableCell>{parseFloat(r.contracted_hours).toFixed(2)}</TableCell>
                          <TableCell>{r.pct_standby === null ? "-" : `${r.pct_standby}%`}</TableCell>
                          <TableCell>{r.pct_ejec_pto === null ? "-" : `${r.pct_ejec_pto}%`}</TableCell>
                          <TableCell>{r.notes || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};

export default HoursReports;
