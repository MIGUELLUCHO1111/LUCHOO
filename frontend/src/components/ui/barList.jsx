// Lista de barras horizontales simple (sin librería de gráficos), mismo
// espíritu minimalista que Donut/TankBar ya usados en el proyecto.
export function BarList({ items, valueKey, labelKey, unit = "", color = "#144763", emptyLabel = "Sin datos" }) {
  const max = Math.max(1, ...items.map((it) => Number(it[valueKey]) || 0));

  if (items.length === 0) {
    return <div className="text-sm text-slate-400 text-center py-8">{emptyLabel}</div>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((it, i) => {
        const value = Number(it[valueKey]) || 0;
        const pct = Math.max(4, (value / max) * 100);
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs font-mono font-bold text-slate-600 dark:text-slate-300 truncate" title={it[labelKey]}>
              {it[labelKey]}
            </span>
            <div className="flex-1 h-5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
            <span className="w-16 shrink-0 text-xs font-bold text-slate-700 dark:text-slate-200 text-right">
              {value % 1 === 0 ? value : value.toFixed(1)}
              {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}
