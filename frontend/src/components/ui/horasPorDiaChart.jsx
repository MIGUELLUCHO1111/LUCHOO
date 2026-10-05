import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Gráfico día por día de Control de Horas -- equivale al gráfico de la hoja
// "Gráfico" del Excel de referencia: columnas apiladas (cobro completo +
// stand-by) y dos líneas (hrs. totales y horas PTO), todo en UN solo eje de
// horas. Colores validados con el validador de paleta (dataviz) en claro y
// oscuro, all-pairs: azul / amarillo / aqua como series, y Horas PTO como
// línea de referencia neutra punteada (es una meta, no una serie más).
// Amarillo y aqua quedan bajo 3:1 sobre fondo claro: la relief rule se
// cumple con la leyenda + la tabla "Resumen por Día" justo debajo.
const SERIES = {
  cobro: { label: "Cobro completo", swatch: "bg-[#2a78d6] dark:bg-[#3987e5]", fill: "fill-[#2a78d6] dark:fill-[#3987e5]" },
  standby: { label: "Stand-by", swatch: "bg-[#eda100] dark:bg-[#c98500]", fill: "fill-[#eda100] dark:fill-[#c98500]" },
  totales: { label: "Hrs. totales", stroke: "stroke-[#1baf7a] dark:stroke-[#199e70]", dot: "fill-[#1baf7a] dark:fill-[#199e70]", swatch: "bg-[#1baf7a] dark:bg-[#199e70]" },
  pto: { label: "Horas PTO", stroke: "stroke-slate-500 dark:stroke-slate-400" },
};

const HEIGHT = 280;
const PAD = { top: 16, right: 16, bottom: 28, left: 40 };
const GAP = 2; // surface gap entre segmentos apilados
const RADIUS = 4;

const niceMax = (v) => {
  if (v <= 0) return 10;
  const step = 10 ** Math.floor(Math.log10(v));
  const n = Math.ceil(v / step);
  const nice = n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * step >= v ? nice * step : Math.ceil(v / step) * step;
};

// Rect con solo las esquinas de arriba redondeadas (extremo de dato), base recta.
const topRoundedPath = (x, y, w, h, r) => {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
};

const fmt = (v) => (v === null || v === undefined ? "-" : Number(v).toLocaleString("es-VE", { maximumFractionDigits: 2 }));

export function HorasPorDiaChart({ data = [], className }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasPto = data.some((d) => d.horas_pto !== null && d.horas_pto !== undefined);

  const { yMax, ticks } = useMemo(() => {
    const max = Math.max(
      0,
      ...data.map((d) => Math.max(d.cobro_completo + d.standby, d.hrs_totales, d.horas_pto ?? 0)),
    );
    const top = niceMax(max);
    const step = top / 4;
    return { yMax: top, ticks: [0, 1, 2, 3, 4].map((i) => +(i * step).toFixed(2)) };
  }, [data]);

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = data.length ? plotW / data.length : plotW;
  const barW = Math.max(4, Math.min(24, band * 0.6));
  const y = (v) => PAD.top + plotH - (v / yMax) * plotH;
  const cx = (i) => PAD.left + band * i + band / 2;
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 28)));

  // Días sin ningún registro llegan con todo en 0: la línea se corta ahí en
  // vez de caer a 0, para no dibujar un "desplome" que no ocurrió.
  const sinDatos = (row) => !row.hrs_totales && !row.cobro_completo && !row.standby;
  const linePath = (key) => {
    let d = "";
    let open = false;
    data.forEach((row, i) => {
      const v = key === "hrs_totales" && sinDatos(row) ? null : row[key];
      if (v === null || v === undefined) { open = false; return; }
      d += `${open ? "L" : "M"}${cx(i)},${y(v)} `;
      open = true;
    });
    return d.trim();
  };

  const hovered = hover !== null ? data[hover] : null;
  const tipLeft = hover !== null ? Math.min(Math.max(cx(hover) + 12, 8), width - 200) : 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
        <li className="flex items-center gap-2"><span className={cn("h-3 w-3 rounded-sm", SERIES.cobro.swatch)} />{SERIES.cobro.label}</li>
        <li className="flex items-center gap-2"><span className={cn("h-3 w-3 rounded-sm", SERIES.standby.swatch)} />{SERIES.standby.label}</li>
        <li className="flex items-center gap-2"><span className={cn("h-0.5 w-4 rounded-full", SERIES.totales.swatch)} />{SERIES.totales.label}</li>
        {hasPto && (
          <li className="flex items-center gap-2">
            <svg width="16" height="4" aria-hidden="true"><line x1="0" y1="2" x2="16" y2="2" strokeWidth="2" strokeDasharray="4 3" className={SERIES.pto.stroke} /></svg>
            {SERIES.pto.label}
          </li>
        )}
      </ul>

      <div ref={wrapRef} className="relative w-full" onMouseLeave={() => setHover(null)}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Horas por día: cobro completo y stand-by apilados, con líneas de horas totales y horas PTO"
          className="block"
        >
          {/* grid + eje Y */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} strokeWidth="1" className="stroke-slate-200 dark:stroke-white/10" />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 dark:fill-slate-500 text-[10px] tabular-nums">
                {fmt(t)}
              </text>
            </g>
          ))}

          {/* columnas apiladas */}
          {data.map((d, i) => {
            const x = cx(i) - barW / 2;
            const hCobro = (d.cobro_completo / yMax) * plotH;
            const hStandby = (d.standby / yMax) * plotH;
            const baseY = PAD.top + plotH;
            const standbyTop = d.standby > 0 && d.cobro_completo > 0;
            return (
              <g key={d.fecha} opacity={hover === null || hover === i ? 1 : 0.45}>
                {d.cobro_completo > 0 && (
                  standbyTop
                    ? <rect x={x} y={baseY - hCobro} width={barW} height={hCobro} className={SERIES.cobro.fill} />
                    : <path d={topRoundedPath(x, baseY - hCobro, barW, hCobro, RADIUS)} className={SERIES.cobro.fill} />
                )}
                {d.standby > 0 && (
                  <path
                    d={topRoundedPath(x, baseY - hCobro - hStandby, barW, Math.max(0, hStandby - (d.cobro_completo > 0 ? GAP : 0)), RADIUS)}
                    className={SERIES.standby.fill}
                  />
                )}
              </g>
            );
          })}

          {/* líneas */}
          <path d={linePath("hrs_totales")} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className={SERIES.totales.stroke} />
          {hasPto && (
            <path d={linePath("horas_pto")} fill="none" strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" className={SERIES.pto.stroke} />
          )}
          {data.map((d, i) =>
            d.hrs_totales > 0 ? (
              <circle key={d.fecha} cx={cx(i)} cy={y(d.hrs_totales)} r="4" strokeWidth="2" className={cn(SERIES.totales.dot, "stroke-white dark:stroke-[#0f1115]")} />
            ) : null,
          )}

          {/* eje X */}
          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d.fecha} x={cx(i)} y={HEIGHT - 8} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500 text-[10px] tabular-nums">
                {Number(d.fecha.slice(8, 10))}
              </text>
            ) : null,
          )}

          {/* crosshair + zonas de hover (una banda completa por día) */}
          {hover !== null && (
            <line x1={cx(hover)} x2={cx(hover)} y1={PAD.top} y2={PAD.top + plotH} strokeWidth="1" className="stroke-slate-300 dark:stroke-white/20" />
          )}
          {data.map((d, i) => (
            <rect
              key={d.fecha}
              x={PAD.left + band * i}
              y={PAD.top}
              width={band}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            />
          ))}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-48 rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#15181e]/95 shadow-lg p-3 text-xs"
            style={{ left: tipLeft }}
          >
            <p className="font-bold text-slate-900 dark:text-white mb-1.5">
              {hovered.fecha.slice(8, 10)}/{hovered.fecha.slice(5, 7)}/{hovered.fecha.slice(0, 4)}
            </p>
            {[
              [SERIES.cobro, hovered.cobro_completo, "rounded-sm h-2.5 w-2.5"],
              [SERIES.standby, hovered.standby, "rounded-sm h-2.5 w-2.5"],
              [SERIES.totales, hovered.hrs_totales, "rounded-full h-0.5 w-3"],
            ].map(([s, v, shape]) => (
              <p key={s.label} className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5"><span className={cn(shape, s.swatch)} />{s.label}</span>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">{fmt(v)}</span>
              </p>
            ))}
            {hasPto && (
              <p className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
                <span>{SERIES.pto.label}</span>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">{fmt(hovered.horas_pto)}</span>
              </p>
            )}
            <p className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300 mt-1 pt-1 border-t border-slate-100 dark:border-white/10">
              <span>% Stand-by</span>
              <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                {hovered.pct_standby === null ? "-" : `${hovered.pct_standby}%`}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
