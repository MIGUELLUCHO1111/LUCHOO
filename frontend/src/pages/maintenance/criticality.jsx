import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldAlert, Search, Settings2, Save } from "lucide-react";
import { maintenanceService } from "@/services";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { Chip, CRIT, ErrorBox, useMntRole, inputCls, labelCls, fmtDate } from "./mntShared";

// Mantenimiento > Criticidad y ajustes (§5 de la política). La base por
// categoría viene de 062_maintenance.sql; aquí se ajusta por unidad.

const SETTINGS = [
  { key: "CORRECTIVA_MAYOR_UMBRAL_USD", label: "Umbral correctiva mayor (USD)", hint: "Desde este costo estimado una correctiva es mayor. Vacío = lo decide solo la criticidad (pendiente de Gerencia + Finanzas).", allowEmpty: true },
  { key: "EMERGENCIA_REGULARIZAR_HORAS", label: "Horas para regularizar una emergencia", hint: "La política pide 24-48 h." },
  { key: "OT_ESTANCADA_DIAS", label: "Días para marcar una OT estancada", hint: "Aparece en “Requiere atención”." },
  { key: "PROXIMO_PORCENTAJE", label: "Plan preventivo: % del intervalo para “próximo”", hint: "Ej. 10 = a 25 h de un servicio de cada 250 h." },
  { key: "PROXIMO_DIAS", label: "Plan preventivo: días para “próximo”", hint: "Por fecha: cuántos días antes se avisa." },
];

export default function Criticality() {
  const role = useMntRole();
  const [rows, setRows] = useState([]);
  const [ajustes, setAjustes] = useState({});
  const [draft, setDraft] = useState({});
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [q, setQ] = useState("");
  const [lvl, setLvl] = useState("");
  const [saving, setSaving] = useState(null);

  const load = useCallback(() => Promise.all([
    maintenanceService.listarCriticidad().then((d) => setRows(Array.isArray(d) ? d : [])),
    maintenanceService.getAjustes().then((a) => { setAjustes(a || {}); setDraft({ ...Object.fromEntries(SETTINGS.map((s) => [s.key, a?.[s.key] ?? ""])), MNT_AUTO_PREVENTIVA: a?.MNT_AUTO_PREVENTIVA === "on" ? "on" : "off" }); }),
  ]).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => (!lvl || r.level === lvl) && (!term || [r.code, r.plate, r.name].some((v) => String(v || "").toLowerCase().includes(term))));
  }, [rows, q, lvl]);

  const saveSettings = async () => {
    setError(null);
    setMsg(null);
    try { const a = await maintenanceService.guardarAjustes(draft); setAjustes(a || {}); setMsg("Ajustes guardados."); }
    catch (e) { setError(e.message); }
  };

  const changeLevel = async (r, level) => {
    setSaving(r.unit_id);
    setError(null);
    try { await maintenanceService.guardarCriticidad(Number(r.unit_id), level, r.note || null); await load(); }
    catch (e) { setError(e.message); }
    finally { setSaving(null); }
  };

  const counts = Object.fromEntries(Object.keys(CRIT).map((k) => [k, rows.filter((r) => r.level === k).length]));

  return (
    <PageLayout icon={ShieldAlert} title="Criticidad y ajustes" subtitle={`MANTENIMIENTO • ${new Date().toLocaleDateString()}`} accentColor="navy">
      <div className="w-full flex flex-col gap-5">
        <ErrorBox>{error}</ErrorBox>
        {/* El ajuste MNT_AUTO_PREVENTIVA se guarda con los demás. */}

        <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0f1115]/80 p-5">
          <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-brand-navy dark:text-white mb-4"><Settings2 size={15} /> Ajustes de Mantenimiento</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SETTINGS.map((s) => (
              <label key={s.key} className="flex flex-col gap-1.5">
                <span className={labelCls}>{s.label}</span>
                <input type="number" min="0" step="0.01" className={inputCls} disabled={!role.isGerencia} value={draft[s.key] ?? ""}
                  placeholder={s.allowEmpty ? "Sin definir" : ""} onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })} />
                <span className="text-[11px] text-slate-500">{s.hint}</span>
              </label>
            ))}
          </div>
          <label className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-white/10 p-3 cursor-pointer">
            <input type="checkbox" className="accent-brand-navy h-5 w-5 mt-0.5" disabled={!role.isGerencia} checked={draft.MNT_AUTO_PREVENTIVA === "on"}
              onChange={(e) => setDraft({ ...draft, MNT_AUTO_PREVENTIVA: e.target.checked ? "on" : "off" })} />
            <span className="text-sm">
              <b className="text-slate-900 dark:text-white">Generar OT preventivas automáticamente</b>
              <span className="block text-xs text-slate-500">Cada mañana (6:00 am) se crea una OT preventiva aprobada por cada servicio del plan que esté vencido y no tenga una OT abierta (§9.1 de la política). Apagado: el supervisor las crea desde el Plan preventivo.</span>
            </span>
          </label>
          {role.isGerencia && (
            <div className="flex items-center justify-end gap-3 mt-4">
              {msg && <span className="text-sm text-emerald-600">{msg}</span>}
              <Button onClick={saveSettings} disabled={SETTINGS.every((s) => String(draft[s.key] ?? "") === String(ajustes[s.key] ?? "")) && draft.MNT_AUTO_PREVENTIVA === (ajustes.MNT_AUTO_PREVENTIVA === "on" ? "on" : "off")} className="rounded-xl bg-brand-navy text-white gap-1.5"><Save size={15} /> Guardar ajustes</Button>
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={16} /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar unidad..." className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] pl-9 pr-3 text-sm" />
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5">
            {[["", "Todas"], ...Object.entries(CRIT).map(([k, v]) => [k, v.label])].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setLvl(k)} className={`h-9 px-3 rounded-lg text-sm font-bold ${lvl === k ? "bg-white dark:bg-[#0f1115] text-brand-navy dark:text-white shadow-sm" : "text-slate-500"}`}>
                {l} <span className="text-xs text-slate-400">{k ? counts[k] : rows.length}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 -mt-2">Base de la política (§5.2): grúas, brazos articulados, camiones cesta y montacargas de 15 t son críticos; montacargas de 2,5-3 t y cargadores, semi-críticos. Una correctiva en un equipo crítico siempre es mayor.</p>

        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0f1115]/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10">
                  <th className="px-4 py-3">Unidad</th><th className="px-2">Flota</th><th className="px-2">Criticidad</th><th className="px-2">Origen</th><th className="px-2 pr-4">Cambiar</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.unit_id} className="border-b border-slate-100 dark:border-white/5">
                    <td className="px-4 py-2.5"><b>{r.code}</b>{r.plate && r.plate !== r.code && <span className="text-slate-400"> · {r.plate}</span>}</td>
                    <td className="px-2 text-slate-500">{r.fleet_type === "PESADA" ? "Pesada" : r.fleet_type === "LIVIANA" ? "Liviana" : "—"}</td>
                    <td className="px-2"><Chip map={CRIT} value={r.level} /></td>
                    <td className="px-2 text-xs text-slate-500">{r.source === "MANUAL" ? `Ajustada${r.updated_by ? ` por ${r.updated_by}` : ""} · ${fmtDate(r.updated_at)}` : "Por categoría"}</td>
                    <td className="px-2 pr-4">
                      {role.isGerencia ? (
                        <select className={`${inputCls} w-40 py-1.5`} disabled={saving === r.unit_id} value={r.level} onChange={(e) => changeLevel(r, e.target.value)}>
                          {Object.entries(CRIT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
