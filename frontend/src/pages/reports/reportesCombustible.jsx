import { useState } from "react";
import { Fuel } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { fuelService } from "@/services";
import { PALETTE, useReportRange, ReportRangeFilter } from "./reportShared";

// "Gasto en USD por Vehículo": top 5 con color propio (alternando navy y
// dorado para que segmentos vecinos no se confundan) + "Otros" en gris.
const TOP_GASTO_VEHICLES = 5;
const TOP_GASTO_COLORS = [PALETTE[0], PALETTE[3], PALETTE[4], PALETTE[5], PALETTE[2]];
const OTROS_COLOR = PALETTE[6];

const FuelReports = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const range = useReportRange(async (from, to) => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fuelService.getFuelSummary({ from, to }));
    } catch (err) {
      console.error("Error cargando resumen de combustible:", err);
      setError("No se pudo cargar el resumen de combustible.");
    } finally {
      setLoading(false);
    }
  });

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
  // Solo los 5 que más gastan tienen su propio segmento; el resto se agrupa
  // en "Otros" (gris) para que la dona siga siendo legible con toda la flota.
  const livianaVehicles = byVehicle
    .filter((v) => v.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const topVehicles = livianaVehicles.slice(0, TOP_GASTO_VEHICLES);
  const otrosAmount = livianaVehicles
    .slice(TOP_GASTO_VEHICLES)
    .reduce((s, v) => s + v.amount, 0);
  const otrosCount = livianaVehicles.length - topVehicles.length;
  const gastoSegments = topVehicles.map((v, i) => ({
    label: v.code,
    value: v.amount,
    color: TOP_GASTO_COLORS[i],
  }));
  if (otrosAmount > 0) {
    gastoSegments.push({
      label: `Otros (${otrosCount} ${otrosCount === 1 ? "vehículo" : "vehículos"})`,
      value: otrosAmount,
      color: OTROS_COLOR,
    });
  }
  const gastoTotal = livianaVehicles.reduce((s, v) => s + v.amount, 0);

  return (
    <PageLayout icon={Fuel} title="Reportes de Combustible" maxWidth="max-w-7xl">
      <div className="flex flex-col gap-8">
        <ReportRangeFilter range={range} error={error} />

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
                  Flota Liviana compra combustible por transacción en estación.
                  Pesada descuenta del tanque propio, sin costo por carga; solo
                  suma gasto si recibió gasolina por una transferencia (el costo
                  se resta de la unidad que la entregó).
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
                      <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${v.fleet_type === "pesada" ? "bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold" : "bg-brand-navy/10 text-brand-navy dark:text-white"}`}>
                        {v.fleet_type === "pesada" ? "Pesada" : "Liviana"}
                      </span>
                    </TableCell>
                    <TableCell className="font-bold text-slate-900 dark:text-white">
                      {v.fleet_type === "pesada" ? `${v.gallons.toFixed(2)} gal` : `${v.liters.toFixed(2)} L`}
                      {v.fleet_type === "pesada" && v.gasolina_liters ? <span className="block text-xs font-normal text-slate-500">+ {v.gasolina_liters.toFixed(2)} L de gasolina transferida</span> : null}
                      {v.transfer_out_liters > 0 && <span className="block text-xs font-normal text-amber-700">− {v.transfer_out_liters.toFixed(2)} L transferidos a otras unidades</span>}
                      {v.fleet_type === "liviana" && v.transfer_in_liters > 0 && <span className="block text-xs font-normal text-slate-500">incluye {v.transfer_in_liters.toFixed(2)} L recibidos</span>}
                    </TableCell>
                    <TableCell>{v.amount != null ? `$${v.amount.toFixed(2)}` : "-"}</TableCell>
                    <TableCell className="font-bold text-slate-900 dark:text-white">{v.count}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PageLayout>
  );
};

export default FuelReports;
