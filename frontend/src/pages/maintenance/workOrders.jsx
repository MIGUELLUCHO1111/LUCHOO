import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Wrench, Plus, Search, AlertTriangle, Siren, PenLine, Lock, Clock, UserX, PauseCircle, Play, Truck } from "lucide-react";
import { maintenanceService } from "@/services";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchableSelect";
import { PageLayout } from "@/components/layout/PageLayout";
import NewWorkOrder from "./newWorkOrder";
import WorkOrderDetail from "./workOrderDetail";
import { Chip, STATUS, KIND, TERMINAL, ROLE_LABEL, useMntRole, missingRoles, fmtDate, usd, daysSince, unitLabel } from "./mntShared";

// Mantenimiento > Órdenes de Trabajo. Con ?unit=<id> funciona como hoja de
// vida de la unidad (todas sus OT); ?ot=<id> abre una OT.
const TABS = [
  ["abiertas", "Abiertas"],
  ["por_aprobar", "Por aprobar"],
  ["en_curso", "En ejecución"],
  ["por_cerrar", "Por cerrar"],
  ["cerradas", "Cerradas"],
  ["todas", "Todas"],
];
const inTab = (w, tab) => {
  if (tab === "abiertas") return !TERMINAL.includes(w.status);
  if (tab === "por_aprobar") return w.status === "SOLICITADA";
  if (tab === "en_curso") return ["APROBADA", "EN_EJECUCION", "ESPERA_REPUESTO"].includes(w.status);
  if (tab === "por_cerrar") return w.status === "EJECUTADA";
  if (tab === "cerradas") return TERMINAL.includes(w.status);
  return true;
};

const Kpi = ({ icon: Icon, label, value, tone = "navy", onClick }) => (
  <button type="button" onClick={onClick} disabled={!onClick}
    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${value > 0 && tone === "red" ? "border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30" : value > 0 && tone === "amber" ? "border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30" : "border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0f1115]/80"} ${onClick ? "hover:border-brand-navy/40 cursor-pointer" : "cursor-default"}`}>
    <span className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-white ${value > 0 && tone === "red" ? "bg-red-600" : value > 0 && tone === "amber" ? "bg-amber-500" : "bg-brand-navy"}`}><Icon size={16} /></span>
    <span className="min-w-0">
      <span className="block text-2xl font-display leading-none text-slate-900 dark:text-white tabular-nums">{value}</span>
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
    </span>
  </button>
);

export default function WorkOrders() {
  const role = useMntRole();
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({ staleDays: 15 });
  const [kpis, setKpis] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(params.get("unit") ? "todas" : "abiertas");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);

  const unitId = params.get("unit") ? Number(params.get("unit")) : null;
  const openId = params.get("ot") ? Number(params.get("ot")) : null;
  const setParam = (k, v) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p); };

  const load = useCallback(() =>
    maintenanceService.listarOrdenes(unitId)
      .then((d) => { setOrders(d?.ordenes || []); setSettings(d?.ajustes || { staleDays: 15 }); setKpis(d?.kpis || null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false)), [unitId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { maintenanceService.listarUnidades().then((d) => setUnits(Array.isArray(d) ? d : [])).catch(() => {}); }, []);

  const now = Date.now();
  const open = orders.filter((w) => !TERMINAL.includes(w.status));
  const mine = (w) => missingRoles(w).some((r) => role.roles.includes(r));
  const emergencies = open.filter((w) => w.kind === "EMERGENCIA" && !w.regularized_at);
  const attention = [
    ...open.filter(mine).map((w) => ({ w, icon: PenLine, tone: "amber", txt: `Falta tu firma (${missingRoles(w).filter((r) => role.roles.includes(r)).map((r) => ROLE_LABEL[r]).join(" / ")})` })),
    ...emergencies.map((w) => ({ w, icon: Siren, tone: w.regularize_due_at && now > new Date(w.regularize_due_at) ? "red" : "amber", txt: w.regularize_due_at && now > new Date(w.regularize_due_at) ? "Emergencia sin regularizar: plazo vencido" : "Emergencia por regularizar" })),
    ...(role.isSupervisor ? open.filter((w) => w.status === "EJECUTADA").map((w) => ({ w, icon: Lock, tone: "amber", txt: "Ejecutada: falta validar y cerrar" })) : []),
    ...open.filter((w) => daysSince(w.opened_at) > (settings.staleDays || 15)).map((w) => ({ w, icon: Clock, tone: "amber", txt: `Estancada: abierta hace ${daysSince(w.opened_at)} días` })),
    ...open.filter((w) => ["EN_EJECUCION", "ESPERA_REPUESTO"].includes(w.status) && !w.technician).map((w) => ({ w, icon: UserX, tone: "amber", txt: "En ejecución sin técnico asignado" })),
  ];

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orders.filter((w) => inTab(w, tab) && (!kind || w.kind === kind) &&
      (!term || [w.number, w.unit_code, w.unit_plate, w.title, w.technician].some((v) => String(v || "").toLowerCase().includes(term))));
  }, [orders, tab, kind, q]);

  const unit = units.find((u) => Number(u.id) === unitId);
  const life = unitId ? {
    total: orders.length,
    closed: orders.filter((w) => w.status === "CERRADA").length,
    parts: orders.filter((w) => w.status !== "ANULADA").reduce((s, w) => s + Number(w.parts_cost_usd || 0), 0),
    hours: orders.filter((w) => w.status !== "ANULADA").reduce((s, w) => s + Number(w.labor_hours || 0), 0),
  } : null;

  return (
    <PageLayout icon={Wrench} title={unit ? `Hoja de vida · ${unit.code}` : "Órdenes de Trabajo"} subtitle={`MANTENIMIENTO • ${new Date().toLocaleDateString()}`} accentColor="navy">
      <div className="w-full flex flex-col gap-5">
        <div className="flex flex-wrap gap-3 items-center">
          <Button onClick={() => setShowNew(true)} className="h-11 rounded-xl bg-brand-gold hover:bg-brand-gold/90 text-slate-900 font-extrabold gap-2 shadow-md shadow-brand-gold/30"><Plus size={17} /> Nueva OT</Button>
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={16} /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por N.º de OT, unidad, título o técnico..." className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] pl-9 pr-3 text-sm" />
          </div>
          <div className="w-64">
            <SearchableSelect items={[{ id: "", code: "Todas las unidades" }, ...units]} getValue={(u) => (u.id === "" ? "" : Number(u.id))} getLabel={(u) => (u.id === "" ? u.code : unitLabel(u))}
              value={unitId ?? ""} onChange={(id) => { setParam("unit", id || null); setTab(id ? "todas" : "abiertas"); }} placeholder="Filtrar por unidad..." />
          </div>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] px-3 text-sm font-bold">
            <option value="">Todos los tipos</option>
            {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {life ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi icon={Wrench} label="OT registradas" value={life.total} />
            <Kpi icon={Lock} label="OT cerradas" value={life.closed} />
            <Kpi icon={Clock} label="Horas de intervención" value={Math.round(life.hours * 10) / 10} />
            <Kpi icon={Truck} label={`Repuestos · ${usd(life.parts)}`} value={orders.reduce((s, w) => s + (w.status !== "ANULADA" && Number(w.parts_cost_usd) > 0 ? 1 : 0), 0)} />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi icon={PenLine} label="Por aprobar" tone="amber" value={open.filter((w) => w.status === "SOLICITADA").length} onClick={() => setTab("por_aprobar")} />
            <Kpi icon={Siren} label="Emergencias sin regularizar" tone="red" value={emergencies.length} onClick={() => { setKind("EMERGENCIA"); setTab("abiertas"); }} />
            <Kpi icon={Play} label="En ejecución" value={open.filter((w) => w.status === "EN_EJECUCION").length} onClick={() => setTab("en_curso")} />
            <Kpi icon={PauseCircle} label="Espera de repuesto" tone="amber" value={open.filter((w) => w.status === "ESPERA_REPUESTO").length} onClick={() => setTab("en_curso")} />
            <Kpi icon={Lock} label="Por cerrar" value={open.filter((w) => w.status === "EJECUTADA").length} onClick={() => setTab("por_cerrar")} />
            <Kpi icon={Truck} label="Unidades paradas" tone="red" value={new Set(open.filter((w) => w.out_of_service).map((w) => w.unit_id)).size} onClick={() => setTab("abiertas")} />
          </div>
        )}

        {!life && kpis && (
          <p className="-mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
            <span>Últimos 90 días: <b>{kpis.cerradas_90d}</b> OT cerradas</span>
            <span>Días medios de cierre: <b>{kpis.dias_medios_cierre ?? "—"}</b></span>
            <span>Horas medias de reparación (correctivas): <b>{kpis.horas_medias_reparacion ?? "—"}</b></span>
          </p>
        )}

        {attention.length > 0 && (
          <div className="rounded-3xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/5 p-4">
            <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-2"><AlertTriangle size={15} /> Requiere atención</h3>
            <div className="flex flex-col gap-1">
              {attention.slice(0, 8).map(({ w, icon: Icon, tone, txt }, i) => (
                <button key={`${w.id}-${i}`} type="button" onClick={() => setParam("ot", w.id)} className="flex flex-wrap items-center gap-2 text-left text-sm rounded-xl px-2 py-1.5 hover:bg-white dark:hover:bg-white/5">
                  <Icon size={15} className={tone === "red" ? "text-red-600" : "text-amber-600"} />
                  <b className="font-mono text-slate-900 dark:text-white">{w.number}</b>
                  <span className="text-slate-500">{w.unit_code}</span>
                  <span className={tone === "red" ? "text-red-700 font-bold" : "text-slate-700 dark:text-slate-200"}>{txt}</span>
                </button>
              ))}
              {attention.length > 8 && <span className="text-xs text-slate-500 px-2">y {attention.length - 8} más</span>}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 self-start">
          {TABS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`h-9 px-3 rounded-lg text-sm font-bold ${tab === k ? "bg-white dark:bg-[#0f1115] text-brand-navy dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}>
              {l} <span className="text-xs text-slate-400 tabular-nums">{orders.filter((w) => inTab(w, k)).length}</span>
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0f1115]/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10">
                  <th className="px-4 py-3">OT</th><th className="px-2">Unidad</th><th className="px-2">Tipo</th><th className="px-2">Título</th><th className="px-2">Estado</th><th className="px-2">Abierta</th><th className="px-2 text-right">Repuestos</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">Cargando...</td></tr>
                ) : shown.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">{orders.length ? "No hay OT con ese filtro." : "Todavía no hay órdenes de trabajo. Crea la primera con “Nueva OT”."}</td></tr>
                ) : shown.map((w) => {
                  const falta = missingRoles(w);
                  return (
                    <tr key={w.id} onClick={() => setParam("ot", w.id)} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">{w.number}</td>
                      <td className="px-2 whitespace-nowrap"><span className="font-bold">{w.unit_code}</span>{w.out_of_service && !TERMINAL.includes(w.status) && <span className="ml-1 text-[10px] font-black text-red-600">PARADA</span>}</td>
                      <td className="px-2"><Chip map={KIND} value={w.kind}>{KIND[w.kind].label}{w.level ? ` ${w.level === "MAYOR" ? "mayor" : "menor"}` : ""}</Chip></td>
                      <td className="px-2 min-w-[200px]">{w.title}{w.tasks_total > 0 && <span className="text-xs text-slate-400"> · {w.tasks_done}/{w.tasks_total} tareas</span>}</td>
                      <td className="px-2">
                        <Chip map={STATUS} value={w.status} />
                        {falta.length > 0 && <span className="block text-[11px] text-amber-700 mt-0.5">Falta: {falta.map((r) => ROLE_LABEL[r].replace("Gerencia de ", "Ger. ").replace("Supervisor de Mantenimiento", "Supervisor")).join(", ")}</span>}
                        {w.kind === "EMERGENCIA" && !w.regularized_at && !TERMINAL.includes(w.status) && <span className="block text-[11px] text-red-600 mt-0.5">Sin regularizar</span>}
                      </td>
                      <td className="px-2 whitespace-nowrap text-slate-500">{fmtDate(w.opened_at)}{!TERMINAL.includes(w.status) && <span className="text-xs"> · {daysSince(w.opened_at)} d</span>}</td>
                      <td className="px-2 pr-4 text-right tabular-nums">{Number(w.parts_cost_usd) > 0 ? usd(w.parts_cost_usd) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showNew && <NewWorkOrder presetUnitId={unitId} onClose={() => setShowNew(false)} onCreated={(wo) => { setShowNew(false); load(); setParam("ot", wo.id); }} />}
      </AnimatePresence>
      <AnimatePresence>
        {openId && <WorkOrderDetail id={openId} onClose={() => setParam("ot", null)} onChanged={load} />}
      </AnimatePresence>
    </PageLayout>
  );
}
