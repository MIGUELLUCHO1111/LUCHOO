import { useState, useEffect } from "react";
import { FileText, MapPin } from "lucide-react";
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
import { fuelService } from "@/services";

const PALETTE = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#9ca3af"];

const firstDayOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

const Reports = () => {
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fuelService.getFuelSummary({ from, to });
      setSummary(res);
    } catch (err) {
      console.error("Error cargando resumen de combustible:", err);
      setError("No se pudo cargar el resumen de combustible.");
    } finally {
      setLoading(false);
    }
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

  return (
    <PageLayout icon={FileText} title="Reportes" maxWidth="max-w-7xl" accentColor="orange">
      <div className="flex flex-col gap-8">
        {/* ---------- Filtro de fechas ---------- */}
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-bold">Desde</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-bold">Hasta</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <Button onClick={loadSummary} className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white">
                Aplicar
              </Button>
            </div>
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          </CardContent>
        </Card>

        {/* ---------- Donas ---------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start justify-items-center">
          <div className="w-full max-w-lg flex flex-col items-center gap-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
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
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
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
                      <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${v.fleet_type === "pesada" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-orange-500/10 text-orange-600 dark:text-orange-400"}`}>
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
