import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { CalendarCheck, Search, ClipboardPlus, History, Plus, Pencil, Archive, RotateCcw, Gauge } from "lucide-react";
import { maintenanceService } from "@/services";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { Modal, ErrorBox, Chip, CRIT, useMntRole, inputCls, labelCls, fmtDate, unitLabel } from "./mntShared";

// Mantenimiento > Plan preventivo (063). Semáforo "cada X horas/km o N días,
// lo que ocurra primero" calculado en el backend (PlanPreventivo.computeDue).

const STATE = {
  VENCIDO: { label: "Vencido", cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  PROXIMO: { label: "Próximo", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  AL_DIA: { label: "Al día", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  SIN_BASE: { label: "Sin base", cls: "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300" },
  SIN_LECTURA: { label: "Sin lectura", cls: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
};
const unitTxt = (meter) => (meter === "HORAS" ? "h" : "km");
const num = (n) => (n == null ? "—" : Number(n).toLocaleString("es-VE", { maximumFractionDigits: 1 }));
const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });

const intervalTxt = (p) => [p.meter && `cada ${num(p.every_meter)} ${unitTxt(p.meter)}`, p.every_days && `cada ${p.every_days} días`].filter(Boolean).join(" o ");

const BaseModal = ({ row, onClose, onSaved }) => {
  const [f, setF] = useState({ done_at: hoy(), meter_value: row.current_meter ?? "" });
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try { await maintenanceService.registrarUltimoServicio({ unit_id: row.unit_id, plan_id: row.plan_id, done_at: f.done_at, meter_value: f.meter_value === "" ? null : f.meter_value }); onSaved(); }
    catch (err) { setError(err.message); }
  };
  return (
    <Modal title="Registrar último servicio" icon={History} onClose={onClose}>
      <ErrorBox>{error}</ErrorBox>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3"><b>{row.unit_code}</b> · {row.plan_name}<br /><span className="text-xs text-slate-500">Es la base desde la que se cuenta el próximo vencimiento ({intervalTxt(row)}).</span></p>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5"><span className={labelCls}>Fecha en que se hizo</span>
          <input type="date" max={hoy()} className={inputCls} value={f.done_at} onChange={(e) => setF({ ...f, done_at: e.target.value })} />
        </label>
        {row.meter && (
          <label className="flex flex-col gap-1.5"><span className={labelCls}>Lectura ({unitTxt(row.meter)})</span>
            <input type="number" min="0" step="0.1" className={inputCls} value={f.meter_value} onChange={(e) => setF({ ...f, meter_value: e.target.value })} />
          </label>
        )}
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="rounded-xl bg-brand-navy text-white">Guardar</Button>
        </div>
      </form>
    </Modal>
  );
};

const PlanModal = ({ plan, onClose, onSaved }) => {
  const [f, setF] = useState({
    id: plan?.id ?? null, name: plan?.name || "", families: plan?.families || "", fleet_type: plan?.fleet_type || "",
    meter: plan?.meter || "", every_meter: plan?.every_meter ?? "", every_days: plan?.every_days ?? "", tasks: plan?.tasks || "", reference: plan?.reference || "",
  });
  const [error, setError] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await maintenanceService.guardarPlan({ ...f, id: f.id ? Number(f.id) : undefined, fleet_type: f.fleet_type || null, meter: f.meter || null, every_meter: f.meter ? f.every_meter : null, every_days: f.every_days === "" ? null : f.every_days });
      onSaved();
    } catch (err) { setError(err.message); }
  };
  return (
    <Modal title={f.id ? "Editar servicio del plan" : "Nuevo servicio del plan"} icon={CalendarCheck} onClose={onClose}>
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <label className="col-span-2 flex flex-col gap-1.5"><span className={labelCls}>Servicio *</span><input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej. Cambio de aceite de motor y filtros" /></label>
        <label className="flex flex-col gap-1.5"><span className={labelCls}>Familias (prefijo del código)</span><input className={inputCls} value={f.families} onChange={(e) => set("families", e.target.value)} placeholder="Ej. GT o BA,CBA" /></label>
        <label className="flex flex-col gap-1.5"><span className={labelCls}>Tipo de flota</span>
          <select className={inputCls} value={f.fleet_type} onChange={(e) => set("fleet_type", e.target.value)}><option value="">Cualquiera</option><option value="PESADA">Pesada</option><option value="LIVIANA">Liviana</option></select>
        </label>
        <label className="flex flex-col gap-1.5"><span className={labelCls}>Por medidor</span>
          <select className={inputCls} value={f.meter} onChange={(e) => set("meter", e.target.value)}><option value="">Solo por fecha</option><option value="HORAS">Horómetro (horas)</option><option value="KM">Odómetro (km)</option></select>
        </label>
        <label className="flex flex-col gap-1.5"><span className={labelCls}>{f.meter ? `Cada cuántas ${unitTxt(f.meter)}` : "—"}</span><input type="number" min="1" disabled={!f.meter} className={inputCls} value={f.every_meter} onChange={(e) => set("every_meter", e.target.value)} /></label>
        <label className="flex flex-col gap-1.5"><span className={labelCls}>Cada cuántos días</span><input type="number" min="1" className={inputCls} value={f.every_days} onChange={(e) => set("every_days", e.target.value)} placeholder={f.meter ? "Opcional" : ""} /></label>
        <label className="flex flex-col gap-1.5"><span className={labelCls}>Referencia</span><input className={inputCls} value={f.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Ej. Manual del fabricante" /></label>
        <label className="col-span-2 flex flex-col gap-1.5"><span className={labelCls}>Tareas de la OT (una por línea)</span><textarea className={`${inputCls} min-h-[70px]`} value={f.tasks} onChange={(e) => set("tasks", e.target.value)} /></label>
        <p className="col-span-2 text-xs text-slate-500">Vence con lo que ocurra primero. Familias = letras del código de la unidad (GT, MT, CF, CC, BA, CBA...).</p>
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="rounded-xl bg-brand-navy text-white">Guardar</Button>
        </div>
      </form>
    </Modal>
  );
};

export default function PreventivePlan() {
  const role = useMntRole();
  const navigate = useNavigate();
  const [tab, setTab] = useState("semaforo");
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState(null);
  const [state, setState] = useState("ATENCION");
  const [q, setQ] = useState("");
  const [base, setBase] = useState(null);
  const [editPlan, setEditPlan] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => Promise.all([
    maintenanceService.listarVencimientos().then(setData),
    maintenanceService.listarPlanes().then((d) => setPlans(Array.isArray(d) ? d : [])),
  ]).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.vencimientos || []).filter((r) =>
      (state === "ATENCION" ? ["VENCIDO", "PROXIMO"].includes(r.state) : !state || r.state === state) &&
      (!term || [r.unit_code, r.unit_plate, r.plan_name].some((v) => String(v || "").toLowerCase().includes(term))));
  }, [data, state, q]);

  const crearOT = async (r) => {
    setBusy(`${r.unit_id}|${r.plan_id}`);
    setError(null);
    try { const wo = await maintenanceService.crearOrdenPreventiva(r.unit_id, r.plan_id); navigate(`/maintenance?ot=${wo.id}`); }
    catch (e) { setError(e.message); }
    finally { setBusy(null); }
  };

  const R = data?.resumen || {};
  const tile = (k, label, value, cls) => (
    <button key={k} type="button" onClick={() => setState(k)} className={`rounded-2xl border p-3 text-left ${state === k ? "border-brand-navy ring-2 ring-brand-navy/20" : "border-slate-200 dark:border-white/10"} bg-white/80 dark:bg-[#0f1115]/80`}>
      <span className={`block text-2xl font-display tabular-nums ${cls}`}>{value ?? "—"}</span>
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
    </button>
  );

  return (
    <PageLayout icon={CalendarCheck} title="Plan preventivo" subtitle={`MANTENIMIENTO • ${new Date().toLocaleDateString()}`} accentColor="navy">
      <div className="w-full flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5">
            {[["semaforo", "Vencimientos"], ["planes", "Planes"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={`h-9 px-4 rounded-lg text-sm font-bold ${tab === k ? "bg-white dark:bg-[#0f1115] text-brand-navy dark:text-white shadow-sm" : "text-slate-500"}`}>{l}</button>
            ))}
          </div>
          <span className={`text-xs font-bold rounded-full px-3 py-1 ${data?.auto_preventiva ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}>
            Generación automática de OT: {data?.auto_preventiva ? "encendida (6:00 am)" : "apagada"}
          </span>
          {role.isGerencia && <button type="button" onClick={() => navigate("/maintenance/criticality")} className="text-xs underline text-slate-500">Cambiar en Ajustes</button>}
        </div>
        <ErrorBox>{error}</ErrorBox>

        {tab === "semaforo" ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {tile("ATENCION", "Vencidos + próximos", (R.vencido ?? 0) + (R.proximo ?? 0), "text-red-600")}
              {tile("VENCIDO", "Vencidos", R.vencido, "text-red-600")}
              {tile("PROXIMO", "Próximos", R.proximo, "text-amber-600")}
              {tile("AL_DIA", "Al día", R.al_dia, "text-emerald-600")}
              {tile("SIN_BASE", "Sin base", R.sin_base, "text-slate-600")}
              {tile("SIN_LECTURA", `Sin lectura · ${R.unidades_sin_lectura ?? 0} unidades`, R.sin_lectura, "text-violet-600")}
            </div>
            {R.sin_base > 0 && (
              <p className="text-xs text-slate-500 -mt-2">
                <b>Sin base</b> = falta registrar cuándo se hizo el último servicio (o cerrar una OT preventiva). <b>Sin lectura</b> = la unidad no tiene lectura de {"horómetro/odómetro"}: regístrala en su ficha de Flota o se toma la anotada en Combustible.
              </p>
            )}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={16} /></span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar unidad o servicio..." className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] pl-9 pr-3 text-sm" />
              </div>
              <button type="button" onClick={() => setState("")} className={`h-11 px-4 rounded-xl text-sm font-bold border ${state === "" ? "border-brand-navy text-brand-navy" : "border-slate-200 text-slate-500"}`}>Ver todo ({data?.vencimientos?.length ?? 0})</button>
            </div>
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0f1115]/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10">
                      <th className="px-4 py-3">Estado</th><th className="px-2">Unidad</th><th className="px-2">Servicio</th><th className="px-2">Último</th><th className="px-2">Medidor actual</th><th className="px-2">Próximo</th><th className="px-2">Falta</th><th className="px-2 pr-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {!data ? <tr><td colSpan={8} className="text-center py-12 text-slate-400">Calculando...</td></tr>
                      : rows.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-slate-400">Nada con ese filtro.</td></tr>
                        : rows.map((r) => (
                          <tr key={`${r.unit_id}-${r.plan_id}`} className="border-b border-slate-100 dark:border-white/5 align-top">
                            <td className="px-4 py-2.5"><Chip map={STATE} value={r.state} /></td>
                            <td className="px-2 whitespace-nowrap"><b>{unitLabel({ code: r.unit_code, plate: r.unit_plate })}</b><span className="block"><Chip map={CRIT} value={r.criticality} /></span></td>
                            <td className="px-2 min-w-[200px]">{r.plan_name}<span className="block text-xs text-slate-400">{intervalTxt(r)}</span></td>
                            <td className="px-2 whitespace-nowrap text-slate-600 dark:text-slate-300">{r.last_done_at ? <>{fmtDate(r.last_done_at)}{r.last_done_meter != null && <span className="block text-xs">{num(r.last_done_meter)} {unitTxt(r.meter)}</span>}</> : "—"}</td>
                            <td className="px-2 whitespace-nowrap">
                              {r.meter ? (r.current_meter != null ? <>{num(r.current_meter)} {unitTxt(r.meter)}<span className="block text-[11px] text-slate-400">{r.meter_source === "COMBUSTIBLE" ? "de Combustible" : "de la ficha"} {fmtDate(r.meter_date)}{r.hours_since_reading > 0 ? ` + ${num(r.hours_since_reading)} h de Control de Horas` : ""}</span></> : <span className="text-violet-600 text-xs font-bold">Sin lectura</span>) : "—"}
                            </td>
                            <td className="px-2 whitespace-nowrap text-slate-600 dark:text-slate-300">{[r.next_meter != null && `${num(r.next_meter)} ${unitTxt(r.meter)}`, r.next_date && fmtDate(r.next_date)].filter(Boolean).join(" · ") || "—"}</td>
                            <td className={`px-2 whitespace-nowrap font-bold ${r.state === "VENCIDO" ? "text-red-600" : r.state === "PROXIMO" ? "text-amber-600" : "text-slate-600 dark:text-slate-300"}`}>
                              {[r.remaining_meter != null && (r.remaining_meter <= 0 ? `pasado ${num(-r.remaining_meter)} ${unitTxt(r.meter)}` : `${num(r.remaining_meter)} ${unitTxt(r.meter)}`), r.remaining_days != null && (r.remaining_days <= 0 ? `vencido hace ${-r.remaining_days} d` : `${r.remaining_days} d`)].filter(Boolean).join(" · ") || "—"}
                            </td>
                            <td className="px-2 pr-4 text-right whitespace-nowrap">
                              {r.open_order ? (
                                <button type="button" onClick={() => navigate(`/maintenance?ot=${r.open_order.id}`)} className="text-xs font-mono underline text-brand-navy dark:text-sky-300">{r.open_order.number}</button>
                              ) : (
                                <span className="inline-flex gap-1">
                                  {role.isSupervisor && <Button size="sm" variant="outline" className="rounded-lg gap-1" onClick={() => setBase(r)}><History size={13} /> {r.last_done_at ? "Base" : "Registrar base"}</Button>}
                                  <Button size="sm" disabled={busy === `${r.unit_id}|${r.plan_id}`} className="rounded-lg bg-brand-navy text-white gap-1" onClick={() => crearOT(r)}><ClipboardPlus size={13} /> OT</Button>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              {role.isSupervisor && <Button onClick={() => setEditPlan({})} className="h-11 rounded-xl bg-brand-gold hover:bg-brand-gold/90 text-slate-900 font-extrabold gap-2"><Plus size={17} /> Nuevo servicio del plan</Button>}
              <p className="text-xs text-slate-500">Base de la política FP-MTTO-PO-01 §7. Se pueden ajustar a lo que pida el manual de cada fabricante.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0f1115]/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10"><th className="px-4 py-3">Aplica a</th><th className="px-2">Servicio</th><th className="px-2">Frecuencia</th><th className="px-2">Referencia</th><th className="px-2">Unidades con base</th><th className="px-2 pr-4" /></tr></thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr key={p.id} className={`border-b border-slate-100 dark:border-white/5 ${p.active ? "" : "opacity-50"}`}>
                        <td className="px-4 py-2.5 font-bold whitespace-nowrap">{p.families || (p.fleet_type === "LIVIANA" ? "Flota liviana" : p.fleet_type === "PESADA" ? "Flota pesada" : "Todas")}</td>
                        <td className="px-2">{p.name}{p.tasks && <span className="block text-xs text-slate-400">{p.tasks.split("\n").join(" · ")}</span>}</td>
                        <td className="px-2 whitespace-nowrap"><Gauge size={13} className="inline mr-1 text-slate-400" />{intervalTxt(p)}</td>
                        <td className="px-2 text-xs text-slate-500">{p.reference || "—"}</td>
                        <td className="px-2 tabular-nums">{p.units_with_base}</td>
                        <td className="px-2 pr-4 text-right whitespace-nowrap">
                          {role.isSupervisor && (
                            <span className="inline-flex gap-1">
                              <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setEditPlan(p)} aria-label="Editar"><Pencil size={13} /></Button>
                              <Button size="sm" variant="outline" className="rounded-lg" onClick={() => maintenanceService.archivarPlan(Number(p.id), !p.active).then(load).catch((e) => setError(e.message))} aria-label={p.active ? "Archivar" : "Reactivar"}>{p.active ? <Archive size={13} /> : <RotateCcw size={13} />}</Button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>{base && <BaseModal row={base} onClose={() => setBase(null)} onSaved={() => { setBase(null); load(); }} />}</AnimatePresence>
      <AnimatePresence>{editPlan && <PlanModal plan={editPlan.id ? editPlan : null} onClose={() => setEditPlan(null)} onSaved={() => { setEditPlan(null); load(); }} />}</AnimatePresence>
    </PageLayout>
  );
}
