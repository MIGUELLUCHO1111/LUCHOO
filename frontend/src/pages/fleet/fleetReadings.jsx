import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gauge, Timer, Plus, RefreshCw, Ban, AlertTriangle, History } from "lucide-react";
import { fleetService } from "@/services";
import { Button } from "@/components/ui/button";
import { fmtDateTime, inputCls } from "./fleetParts";

// Historial de lecturas de odometro/horometro (050_fleet_unit_reading.sql):
// no se editan, se vuelven a leer; un admin anula una lectura con motivo.

export const SOURCE = {
  BASE: { label: "Base", cls: "bg-brand-navy/10 text-brand-navy dark:text-sky-300", dot: "#144763" },
  MANUAL: { label: "Manual", cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300", dot: "#64748b" },
  GPS: { label: "GPS", cls: "bg-emerald-500/10 text-emerald-600", dot: "#10b981" },
  COMBUSTIBLE: { label: "Combustible", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400", dot: "#f59e0b" },
  MANTENIMIENTO: { label: "Mantenimiento", cls: "bg-orange-500/10 text-orange-600", dot: "#f97316" },
  REEMPLAZO: { label: "Tablero nuevo", cls: "bg-violet-500/10 text-violet-600", dot: "#8b5cf6" },
};
const METER = { KM: { label: "Odómetro", unit: "km", icon: Gauge }, HORAS: { label: "Horómetro", unit: "h", icon: Timer } };
const num = (n) => Number(n).toLocaleString("es-VE", { maximumFractionDigits: 1 });
const nowLocal = () => {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Linea de la serie actual, a escala (x = tiempo, y = valor).
const SeriesChart = ({ puntos, unit }) => {
  if (puntos.length < 2) return null;
  const W = 600, H = 120, P = 18;
  const xs = puntos.map((p) => new Date(p.read_at).getTime());
  const ys = puntos.map((p) => p.value);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (x) => P + ((x - x0) / Math.max(1, x1 - x0)) * (W - 2 * P);
  const sy = (y) => H - P - ((y - y0) / Math.max(1, y1 - y0)) * (H - 2 * P);
  const d = puntos.map((p, i) => `${i ? "L" : "M"}${sx(new Date(p.read_at).getTime()).toFixed(1)},${sy(p.value).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none">
      <line x1={P} x2={W - P} y1={H - P} y2={H - P} className="stroke-slate-200 dark:stroke-white/10" strokeWidth="1" />
      <motion.path d={d} fill="none" className="stroke-brand-navy dark:stroke-sky-300" strokeWidth="2.5" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />
      {puntos.map((p) => (
        <circle key={p.id} cx={sx(new Date(p.read_at).getTime())} cy={sy(p.value)} r="4" fill={SOURCE[p.source]?.dot || "#64748b"} stroke="white" strokeWidth="1.5">
          <title>{`${num(p.value)} ${unit} · ${SOURCE[p.source]?.label || p.source} · ${fmtDateTime(p.read_at)}`}</title>
        </circle>
      ))}
      <text x={P} y={12} className="fill-slate-400 text-[10px]">{num(y1)} {unit}</text>
      <text x={P} y={H - 4} className="fill-slate-400 text-[10px]">{num(y0)} {unit}</text>
    </svg>
  );
};

const ReadingForm = ({ unitId, medidores, replace, onCancel, onSaved }) => {
  const [meter, setMeter] = useState(medidores[0]);
  const [value, setValue] = useState("");
  const [readAt, setReadAt] = useState(nowLocal());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { meter, value, read_at: new Date(readAt).toISOString(), note };
      if (replace) await fleetService.reemplazarMedidor(unitId, payload);
      else await fleetService.registrarLectura(unitId, payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={save} className="overflow-hidden">
      <div className={`rounded-2xl p-4 mb-4 space-y-3 ${replace ? "bg-violet-500/5 border border-violet-500/20" : "bg-slate-50 dark:bg-white/[0.03]"}`}>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{replace ? "Tablero reemplazado" : "Registrar lectura"}</p>
        {replace && <p className="text-xs text-slate-500">Úsalo solo si se cambió el tablero: la lectura del tablero nuevo empieza una serie nueva y el historial anterior se conserva.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {medidores.length > 1 ? (
            <select value={meter} onChange={(e) => setMeter(e.target.value)} className={inputCls}>
              {medidores.map((m) => <option key={m} value={m}>{METER[m].label} ({METER[m].unit})</option>)}
            </select>
          ) : (
            <div className={`${inputCls} flex items-center text-slate-500`}>{METER[meter].label} ({METER[meter].unit})</div>
          )}
          <input required type="number" step="0.1" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder={replace ? `Lectura del tablero nuevo (${METER[meter].unit})` : `Lectura (${METER[meter].unit})`} className={inputCls} />
          <input required type="datetime-local" value={readAt} onChange={(e) => setReadAt(e.target.value)} className={inputCls} />
        </div>
        <input required={replace} value={note} onChange={(e) => setNote(e.target.value)} placeholder={replace ? "Motivo del reemplazo (obligatorio)" : "Nota (opcional)"} className={inputCls} />
        {error && <p className="flex items-start gap-1.5 text-xs font-bold text-red-600"><span className="inline-flex mt-0.5"><AlertTriangle size={13} /></span>{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-xl h-9" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={saving} className={`rounded-xl h-9 text-white ${replace ? "bg-violet-600 hover:bg-violet-700" : "bg-brand-navy hover:bg-brand-navy-light"}`}>{saving ? "Guardando…" : replace ? "Registrar reemplazo" : "Guardar lectura"}</Button>
        </div>
      </div>
    </motion.form>
  );
};

const VoidButton = ({ reading, onDone }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const go = async () => {
    try {
      await fleetService.anularLectura(reading.id, reason);
      onDone();
    } catch (e) {
      setError(e.message);
    }
  };
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="opacity-0 group-hover:opacity-100 text-[11px] font-bold text-slate-400 hover:text-red-500 inline-flex items-center gap-1"><Ban size={12} /> Anular</button>;
  return (
    <span className="flex items-center gap-1.5">
      <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" className="w-36 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] px-2 py-1 text-xs" />
      <button type="button" disabled={!reason.trim()} onClick={go} className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40">Anular</button>
      <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-slate-400">✕</button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
};

/** Pestaña "Lecturas" de la ficha. */
const ReadingsPanel = ({ unit, canEdit, isAdmin, onChange }) => {
  const lect = unit.lecturas || { medidores: ["KM"], actual: {}, historial: [] };
  const [form, setForm] = useState(null); // "lectura" | "reemplazo"
  const [filtro, setFiltro] = useState(lect.medidores[0] || "KM");
  const medidores = [...new Set([...lect.medidores, ...Object.keys(lect.actual)])];

  const historial = useMemo(() => {
    const lista = lect.historial.filter((h) => h.meter === filtro);
    // Diferencia contra la lectura vigente anterior del mismo medidor.
    const vivas = lista.filter((h) => !h.voided_at).slice().reverse();
    const diff = new Map();
    vivas.forEach((h, i) => { if (i > 0 && h.source !== "REEMPLAZO") diff.set(h.id, h.value - vivas[i - 1].value); });
    return lista.map((h) => ({ ...h, diff: diff.get(h.id) }));
  }, [lect.historial, filtro]);
  const serie = useMemo(() => {
    const vivas = lect.historial.filter((h) => h.meter === filtro && !h.voided_at);
    const base = vivas.find((h) => h.source === "BASE" || h.source === "REEMPLAZO");
    return (base ? vivas.filter((h) => new Date(h.read_at) >= new Date(base.read_at)) : vivas).slice().reverse();
  }, [lect.historial, filtro]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {medidores.map((m) => {
          const a = lect.actual[m];
          const M = METER[m];
          return (
            <button type="button" key={m} onClick={() => setFiltro(m)} className={`text-left rounded-2xl border p-4 transition-colors ${filtro === m ? "border-brand-navy/30 bg-brand-navy/5 dark:bg-white/5" : "border-slate-100 dark:border-white/5"}`}>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400"><span className="inline-flex"><M.icon size={12} /></span> {M.label}</p>
              {a ? (
                <>
                  <p className="font-display text-3xl text-slate-900 dark:text-white mt-1">{num(a.valor)} <span className="text-sm text-slate-400">{M.unit}</span></p>
                  <p className="text-[11px] text-slate-500 mt-1"><span className={`rounded-full px-2 py-0.5 font-bold ${SOURCE[a.fuente]?.cls}`}>{SOURCE[a.fuente]?.label || a.fuente}</span> · {fmtDateTime(a.fecha)}</p>
                  {a.base && <p className="text-[11px] text-slate-400 mt-1">{a.base.reemplazo ? "Tablero reemplazado" : "Lectura base"}: {num(a.base.valor)} {M.unit} · {fmtDateTime(a.base.fecha)}</p>}
                  {a.estimado && <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mt-1">Con Control de Horas: ≈ {num(a.estimado.valor)} h (+{num(a.estimado.horas)} h en {a.estimado.dias} día(s), hasta {a.estimado.hasta})</p>}
                </>
              ) : (
                <p className="text-sm text-slate-400 mt-2">Sin lecturas. La primera que registres será la <b>lectura base</b>.</p>
              )}
            </button>
          );
        })}
      </div>

      {serie.length >= 2 && <div className="rounded-2xl border border-slate-100 dark:border-white/5 px-2 pt-2"><SeriesChart puntos={serie} unit={METER[filtro]?.unit} /></div>}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setForm(form === "lectura" ? null : "lectura")} className="rounded-xl h-9 gap-1.5 bg-brand-navy hover:bg-brand-navy-light text-white"><Plus size={14} /> Registrar lectura</Button>
          <Button type="button" variant="outline" onClick={() => setForm(form === "reemplazo" ? null : "reemplazo")} className="rounded-xl h-9 gap-1.5"><RefreshCw size={14} /> Tablero reemplazado</Button>
        </div>
      )}
      <AnimatePresence>
        {form && <ReadingForm key={form} unitId={unit.id} medidores={medidores} replace={form === "reemplazo"} onCancel={() => setForm(null)} onSaved={() => { setForm(null); onChange(); }} />}
      </AnimatePresence>

      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2"><span className="inline-flex"><History size={13} /></span> Historial de {METER[filtro]?.label.toLowerCase()}</p>
        {historial.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Todavía no hay lecturas.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {historial.map((h) => (
              <li key={h.id} className={`group py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 ${h.voided_at ? "opacity-50" : ""}`}>
                <span className={`font-mono text-sm font-bold w-28 ${h.voided_at ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>{num(h.value)} {METER[h.meter]?.unit}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${SOURCE[h.source]?.cls}`}>{SOURCE[h.source]?.label || h.source}</span>
                {h.diff != null && <span className="text-[11px] font-bold text-emerald-600">+{num(h.diff)}</span>}
                <span className="text-[11px] text-slate-400">{fmtDateTime(h.read_at)}{h.created_by && h.created_by !== "GPS" ? ` · ${h.created_by}` : ""}</span>
                {h.note && <span className="text-[11px] text-slate-500 truncate max-w-[260px]" title={h.note}>{h.note}</span>}
                {h.voided_at && <span className="text-[11px] text-red-600">Anulada: {h.void_reason}</span>}
                <span className="ml-auto">{isAdmin && !h.voided_at && !h.derived && <VoidButton reading={h} onDone={onChange} />}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-400 mt-3">Las lecturas no se editan: si una está mal, se registra otra (o un admin la anula con motivo). Las de Combustible se toman de los llenados y la del GPS se guarda sola una vez al día.</p>
      </div>
    </div>
  );
};

export default ReadingsPanel;
