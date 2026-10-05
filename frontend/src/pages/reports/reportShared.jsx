import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { veTodayISO } from "@/lib/trackerFormat";

// Paleta categórica de marca para las donas (navy + dorado Fullpetro, con
// tonos de apoyo neutros/oscuros para cuando un gráfico necesita más de 3-4
// series). Los índices se mantienen (0 y 3 para Liviana/Pesada, 4 y 5 para
// Cobro Completo/Stand-By, el resto para el ciclo por vehículo de "Gasto en USD").
export const PALETTE = ["#144763", "#191919", "#0d3549", "#ffcc00", "#1d5c7f", "#e0b400", "#64748b", "#a8842a"];

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

// Rango de fechas de una página de reportes. `load(from, to)` recibe el rango
// explícito para poder llamarse justo después de cambiar el selector, sin
// depender de que `from`/`to` ya se hayan actualizado en el state.
export const useReportRange = (load) => {
  const [initial] = useState(() => computeRangeForFilter("semana"));
  const [filterType, setFilterType] = useState("semana");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  useEffect(() => {
    load(initial.from, initial.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeType = (value) => {
    setFilterType(value);
    if (value === "personalizado") return; // deja from/to como están, editables a mano
    const range = computeRangeForFilter(value);
    setFrom(range.from);
    setTo(range.to);
    load(range.from, range.to);
  };

  return { filterType, from, to, setFrom, setTo, changeType, apply: () => load(from, to) };
};

export const ReportRangeFilter = ({ range, error }) => {
  const custom = range.filterType === "personalizado";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-bold">Rango</Label>
            <select
              value={range.filterType}
              onChange={(e) => range.changeType(e.target.value)}
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
              value={range.from}
              disabled={!custom}
              onChange={(e) => range.setFrom(e.target.value)}
              className={!custom ? "opacity-60" : ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-bold">Hasta</Label>
            <Input
              type="date"
              value={range.to}
              disabled={!custom}
              onChange={(e) => range.setTo(e.target.value)}
              className={!custom ? "opacity-60" : ""}
            />
          </div>
          {custom && (
            <Button onClick={range.apply} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">
              Aplicar
            </Button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </CardContent>
    </Card>
  );
};
