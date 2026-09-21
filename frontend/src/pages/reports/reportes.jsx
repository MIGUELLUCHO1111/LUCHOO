import { useState, useEffect } from "react";
import { FileText, MapPin, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { PageLayout } from "@/components/layout/PageLayout";
import { fuelService, hoursService } from "@/services";
import { veTodayISO, formatFechaISO } from "@/lib/trackerFormat";

// Paleta categórica de marca para las donas (navy + dorado Fullpetro, con
// tonos de apoyo neutros/oscuros para cuando un gráfico necesita más de 3-4
// series) -- reemplaza la paleta genérica azul/violeta/verde/rojo anterior.
// Los índices se mantienen (0 y 3 para Liviana/Pesada, 4 y 5 para Cobro
// Completo/Stand-By, el resto para el ciclo por vehículo de "Gasto en USD").
const PALETTE = ["#144763", "#191919", "#0d3549", "#ffcc00", "#1d5c7f", "#e0b400", "#64748b", "#a8842a"];

// Aritmética de fechas "puras" (YYYY-MM-DD) anclada a medianoche UTC, igual
// que en dailyEntry.jsx -- evita que un new Date(iso) local se corra un día
// según la zona horaria del navegador.
const shiftDate = (isoDate, days) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const mondayOf = (isoDate) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=domingo ... 6=sábado
  const diff = day === 0 ? 6 : day - 1; // días desde el lunes
  return shiftDate(isoDate, -diff);
};

const RANGE_OPTIONS = [
  { value: "dia", label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "15d", label: "Últimos 15 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "personalizado", label: "Personalizado" },
];

// "Esta semana" es semana-a-la-fecha (lunes -> hoy), no la semana completa:
// si hoy es miércoles de la semana 1, solo cuenta lunes/martes/miércoles.
const computeRangeForFilter = (filterType) => {
  const todayIso = veTodayISO();
  switch (filterType) {
    case "dia":
      return { from: todayIso, to: todayIso };
    case "semana":
      return { from: mondayOf(todayIso), to: todayIso };
    case "7d":
      return { from: shiftDate(todayIso, -6), to: todayIso };
    case "15d":
      return { from: shiftDate(todayIso, -14), to: todayIso };
    case "30d":
      return { from: shiftDate(todayIso, -29), to: todayIso };
    default:
      return null; // 'personalizado' -- no se toca el rango actual
  }
};

const Reports = () => {
  const [filterType, setFilterType] = useState("semana");
  const initialRange = computeRangeForFilter("semana");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    loadSummary();
    hoursService.getAllEmpresas().then((res) => setDetalleCompanies(Array.isArray(res) ? res : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Acepta un rango explícito para poder llamarse justo después de cambiar
  // el selector de rango sin depender de que `from`/`to` ya se hayan
  // actualizado en el state (los setState de React no son síncronos).
  const loadSummary = async (overrideFrom, overrideTo) => {
    const f = overrideFrom ?? from;
    const t = overrideTo ?? to;

    setLoading(true);
    setError(null);
    setHorasLoading(true);
    setHorasError(null);
    setPorDiaLoading(true);
    setPorDiaError(null);
    try {
      const res = await fuelService.getFuelSummary({ from: f, to: t });
      setSummary(res);
    } catch (err) {
      console.error("Error cargando resumen de combustible:", err);
      setError("No se pudo cargar el resumen de combustible.");
    } finally {
      setLoading(false);
    }

    try {
      const res = await hoursService.getResumenHoras({ from: f, to: t });
      setHorasSummary(res);
    } catch (err) {
      console.error("Error cargando resumen de horas:", err);
      setHorasError("No se pudo cargar el resumen de Control de Horas.");
    } finally {
      setHorasLoading(false);
    }

    try {
      const res = await hoursService.getResumenPorDia({ from: f, to: t });
      setPorDia(Array.isArray(res?.porDia) ? res.porDia : []);
    } catch (err) {
      console.error("Error cargando el resumen por día:", err);
      setPorDiaError("No se pudo cargar el resumen día por día.");
    } finally {
      setPorDiaLoading(false);
    }
  };

  const handleFilterTypeChange = (value) => {
    setFilterType(value);
    if (value === "personalizado") return; // deja from/to como están, editables a mano
    const range = computeRangeForFilter(value);
    setFrom(range.from);
    setTo(range.to);
    loadSummary(range.from, range.to);
  };

  const byVehicle = summary?.byVehicle || [];
  const totals = summary?.totals || {
    liviana: { liters: 0, amount: 0, count: 0 },
    pesada: { gallons: 0, liters_equivalent: 0, count: 0 },
  };

  // ---------- Dona 1: combustible por flota (litros equivalentes) ----------
  const flotaSegments = [
    { label: "Liviana (litros)", value: totals.liviana.liters, color: PALETTE[0] },
    { label: "Pesada (litros equiv.)", value: totals.pesada.liters_equivalent, color: PALETTE[3] },
  ].filter((s) => s.value > 0);
  const flotaTotal = totals.liviana.liters + totals.pesada.liters_equivalent;

  // ---------- Dona 2: gasto USD por vehículo (solo Liviana) ----------
  const livianaVehicles = byVehicle.filter((v) => v.fleet_type === "liviana" && v.amount > 0);
  const gastoSegments = livianaVehicles.map((v, i) => ({
    label: v.code,
    value: v.amount,
    color: PALETTE[i % PALETTE.length],
  }));
  const gastoTotal = livianaVehicles.reduce((s, v) => s + v.amount, 0);

  // ---------- Dona 3: Control de Horas -- cobro completo vs stand-by ----------
  const horasTotals = horasSummary?.totals || { cobro_completo: 0, standby: 0, hrs_totales: 0, pct_standby: null };
  const horasByProyecto = horasSummary?.byProyecto || [];
  const horasByEquipo = horasSummary?.byEquipo || [];
  const horasSegments = [
    { label: "Cobro Completo", value: horasTotals.cobro_completo, color: PALETTE[4] },
    { label: "Stand-By", value: horasTotals.standby, color: PALETTE[5] },
  ].filter((s) => s.value > 0);
  const horasTotalHrs = horasTotals.cobro_completo + horasTotals.standby;

  return (
    <PageLayout icon={FileText} title="Reportes" maxWidth="max-w-7xl">
      <div className="flex flex-col gap-8">
        {/* ---------- Filtro de fechas ---------- */}
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-bold">Rango</Label>
                <select
                  value={filterType}
                  onChange={(e) => handleFilterTypeChange(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm h-10"
                >
                  {RANGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-bold">Desde</Label>
                <Input
                  type="date"
                  value={from}
                  disabled={filterType !== "personalizado"}
                  onChange={(e) => setFrom(e.target.value)}
                  className={filterType !== "personalizado" ? "opacity-60" : ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-bold">Hasta</Label>
                <Input
                  type="date"
                  value={to}
                  disabled={filterType !== "personalizado"}
                  onChange={(e) => setTo(e.target.value)}
                  className={filterType !== "personalizado" ? "opacity-60" : ""}
                />
              </div>
              {filterType === "personalizado" && (
                <Button onClick={() => loadSummary()} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">
                  Aplicar
                </Button>
              )}
            </div>
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          </CardContent>
        </Card>

        {/* ---------- Donas ---------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start justify-items-center">
          <div className="w-full max-w-lg flex flex-col items-center gap-4">
            <h3 className="text-sm font-display uppercase tracking-widest text-slate-900 dark:text-white">
              Combustible por Flota
            </h3>
            <Card className="w-full">
              <CardContent className="p-8 flex flex-col items-center gap-6">
                {loading ? (
                  <p className="text-sm text-slate-400 py-8">Cargando...</p>
                ) : flotaSegments.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8">Sin llenados en este rango</p>
                ) : (
                  <>
                    <Donut segments={flotaSegments} centerLabel="Litros" centerValue={Math.round(flotaTotal)} />
                    <ul className="w-full space-y-2">
                      {flotaSegments.map((s, i) => (
                        <li key={i} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.label}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">{s.value.toFixed(2)} L</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="text-[11px] text-slate-400 text-center">
                  Pesada se mide en galones; se muestra convertida a litros
                  equivalentes (1 gal = 3.78541 L) para poder comparar con Liviana.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="w-full max-w-lg flex flex-col items-center gap-4">
            <h3 className="text-sm font-display uppercase tracking-widest text-slate-900 dark:text-white">
              Gasto en USD por Vehículo
            </h3>
            <Card className="w-full">
              <CardContent className="p-8 flex flex-col items-center gap-6">
                {loading ? (
                  <p className="text-sm text-slate-400 py-8">Cargando...</p>
                ) : gastoSegments.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8">Sin gasto registrado en este rango</p>
                ) : (
                  <>
                    <Donut segments={gastoSegments} centerLabel="Total USD" centerValue={`$${Math.round(gastoTotal)}`} />
                    <ul className="w-full space-y-2">
                      {gastoSegments.map((s, i) => (
                        <li key={i} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.label}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">${s.value.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="text-[11px] text-slate-400 text-center">
                  Solo Flota Liviana: compra combustible por transacción en
                  estación. Pesada descuenta del tanque propio de la empresa, sin
                  costo por carga individual.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ---------- Tabla por vehículo ---------- */}
        <Card className="w-full overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Flota</TableHead>
                <TableHead>Litros/Galones</TableHead>
                <TableHead>Gasto USD</TableHead>
                <TableHead>Nº Llenados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : byVehicle.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    No hay llenados registrados en este rango
                  </TableCell>
                </TableRow>
              ) : (
                byVehicle.map((v, i) => (
                  <TableRow key={v.vehicle_id} className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                    <TableCell className="font-mono font-bold text-slate-900 dark:text-white">{v.code}</TableCell>
                    <TableCell>{v.name}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${v.fleet_type === "pesada" ? "bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold" : "bg-brand-navy/10 text-brand-navy dark:text-brand-navy-light"}`}>
                        {v.fleet_type === "pesada" ? "Pesada" : "Liviana"}
                      </span>
                    </TableCell>
                    <TableCell className="font-bold text-slate-900 dark:text-white">
                      {v.fleet_type === "pesada" ? `${v.gallons.toFixed(2)} gal` : `${v.liters.toFixed(2)} L`}
                    </TableCell>
                    <TableCell>{v.amount != null ? `$${v.amount.toFixed(2)}` : "-"}</TableCell>
                    <TableCell className="font-bold text-slate-900 dark:text-white">{v.count}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* ---------- Control de Horas: cobro completo vs stand-by ---------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start justify-items-center">
          <div className="w-full max-w-lg flex flex-col items-center gap-4">
            <h3 className="text-sm font-display uppercase tracking-widest text-slate-900 dark:text-white">
              Control de Horas — Cobro Completo vs Stand-By
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {horasLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : horasByProyecto.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-slate-400">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {horasLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : horasByEquipo.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* ---------- Control de Horas: resumen día por día (todos los días del rango) ---------- */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-display uppercase tracking-widest text-slate-900 dark:text-white">
            Control de Horas — Resumen por Día
          </h3>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porDiaLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : porDiaError ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-red-500">
                        {porDiaError}
                      </TableCell>
                    </TableRow>
                  ) : porDia.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400">
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
            Control de Horas — Detalle de un Día
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

        {/* ---------- Próximamente: rentabilidad en $ (Control de Horas) ---------- */}
        <Card className="w-full border-dashed border-2 border-slate-300 dark:border-slate-700">
          <CardContent className="p-6 flex items-start gap-4">
            <DollarSign size={28} className="text-slate-400 shrink-0 mt-1" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white mb-1">
                Próximamente: Rentabilidad en Dólares
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Arriba se muestran las horas reales de Control de Horas (Cobro
                Completo vs Stand-By). Convertir esto a rentabilidad en dólares
                requiere tarifas $/hora que todavía no existen en el sistema —
                se activa en cuanto se definan (ver
                <code className="mx-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-xs">
                  ROADMAP_HORAS_RENTABILIDAD.md
                </code>
                ).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ---------- Próximamente: infracciones y kilómetros (GPS) ---------- */}
        <Card className="w-full border-dashed border-2 border-slate-300 dark:border-slate-700">
          <CardContent className="p-6 flex items-start gap-4">
            <MapPin size={28} className="text-slate-400 shrink-0 mt-1" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white mb-1">
                Próximamente: Infracciones y Kilómetros Recorridos
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Estas métricas dependen de la integración con el tracker GPS
                (Foresight), que todavía no está completamente habilitada — solo
                hay una unidad certificada para el demo y el endpoint de eventos
                de conducción sigue sin devolver datos. Se activan aquí en cuanto
                el proveedor libere el resto de la flota (ver
                <code className="mx-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-xs">
                  INTEGRACION_GPS_FORESIGHT.md
                </code>
                para el detalle de las pruebas hechas).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
};

export default Reports;
