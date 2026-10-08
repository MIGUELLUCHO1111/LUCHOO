import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, Plus, Search, ClipboardPlus, Ban } from "lucide-react";
import { maintenanceService } from "@/services";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchableSelect";
import { PageLayout } from "@/components/layout/PageLayout";
import NewWorkOrder from "./newWorkOrder";
import { Modal, ErrorBox, Chip, INC_STATUS, PRIORITY, FAILURE, useMntRole, inputCls, labelCls, fmtDateTime, unitLabel } from "./mntShared";

// Mantenimiento > Incidencias: lo que se observa en una unidad (falla,
// hallazgo, comentario del operador). Se resuelven dentro de una OT.

const NewIncident = ({ units, onClose, onSaved }) => {
  const [f, setF] = useState({ unit_id: null, title: "", description: "", priority: "MEDIA", failure_system: "" });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try { await maintenanceService.crearIncidencia({ ...f, failure_system: f.failure_system || null, description: f.description || null }); onSaved(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  return (
    <Modal title="Anotar incidencia" icon={AlertTriangle} onClose={onClose}>
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5"><span className={labelCls}>Unidad *</span>
          <SearchableSelect items={units} getValue={(u) => Number(u.id)} getLabel={unitLabel} value={f.unit_id} onChange={(id) => setF({ ...f, unit_id: id })} placeholder="Buscar por código o placa..." />
        </label>
        <label className="flex flex-col gap-1.5"><span className={labelCls}>Qué se observó *</span>
          <input className={inputCls} value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ej. Fuga de aceite en el cárter" />
        </label>
        <label className="flex flex-col gap-1.5"><span className={labelCls}>Detalle</span>
          <textarea className={`${inputCls} min-h-[70px]`} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5"><span className={labelCls}>Prioridad</span>
            <select className={inputCls} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
              {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5"><span className={labelCls}>Sistema</span>
            <select className={inputCls} value={f.failure_system} onChange={(e) => setF({ ...f, failure_system: e.target.value })}>
              <option value="">No sé / por diagnosticar</option>
              {Object.entries(FAILURE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || !f.unit_id || !f.title.trim()} className="rounded-xl bg-brand-navy text-white">{saving ? "Guardando..." : "Anotar"}</Button>
        </div>
      </form>
    </Modal>
  );
};

const Discard = ({ inc, onClose, onSaved }) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try { await maintenanceService.descartarIncidencia(Number(inc.id), reason); onSaved(); } catch (err) { setError(err.message); }
  };
  return (
    <Modal title="Descartar incidencia" icon={Ban} onClose={onClose}>
      <ErrorBox>{error}</ErrorBox>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3"><b>{inc.unit_code}</b> · {inc.title}</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <textarea className={`${inputCls} min-h-[70px]`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Por qué no requiere trabajo (falsa alarma, duplicada, se resolvió en sitio...)" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!reason.trim()} className="rounded-xl bg-red-600 hover:bg-red-700 text-white">Descartar</Button>
        </div>
      </form>
    </Modal>
  );
};

export default function Incidents() {
  const role = useMntRole();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("ABIERTA");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [discard, setDiscard] = useState(null);
  const [newOt, setNewOt] = useState(null);

  const load = useCallback(() => maintenanceService.listarIncidencias().then((d) => setRows(Array.isArray(d) ? d : [])).catch((e) => setError(e.message)).finally(() => setLoading(false)), []);
  useEffect(() => { load(); maintenanceService.listarUnidades().then((d) => setUnits(Array.isArray(d) ? d : [])).catch(() => {}); }, [load]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((i) => (!filter || i.status === filter) && (!term || [i.unit_code, i.unit_plate, i.title, i.reported_by].some((v) => String(v || "").toLowerCase().includes(term))));
  }, [rows, filter, q]);

  const selected = rows.filter((i) => sel.includes(Number(i.id)));
  const selUnit = selected[0]?.unit_id;
  const sameUnit = selected.every((i) => i.unit_id === selUnit);
  const toggle = (i) => setSel((s) => (s.includes(Number(i.id)) ? s.filter((x) => x !== Number(i.id)) : [...s, Number(i.id)]));

  return (
    <PageLayout icon={AlertTriangle} title="Incidencias" subtitle={`MANTENIMIENTO • ${new Date().toLocaleDateString()}`} accentColor="navy">
      <div className="w-full flex flex-col gap-5">
        <div className="flex flex-wrap gap-3 items-center">
          <Button onClick={() => setShowNew(true)} className="h-11 rounded-xl bg-brand-gold hover:bg-brand-gold/90 text-slate-900 font-extrabold gap-2 shadow-md shadow-brand-gold/30"><Plus size={17} /> Anotar incidencia</Button>
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={16} /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por unidad, descripción o quién la reportó..." className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] pl-9 pr-3 text-sm" />
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5">
            {[["ABIERTA", "Abiertas"], ["EN_OT", "En OT"], ["RESUELTA", "Resueltas"], ["DESCARTADA", "Descartadas"], ["", "Todas"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => { setFilter(k); setSel([]); }} className={`h-9 px-3 rounded-lg text-sm font-bold ${filter === k ? "bg-white dark:bg-[#0f1115] text-brand-navy dark:text-white shadow-sm" : "text-slate-500"}`}>
                {l} <span className="text-xs text-slate-400">{rows.filter((i) => !k || i.status === k).length}</span>
              </button>
            ))}
          </div>
        </div>

        {sel.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-navy/20 bg-brand-navy/5 dark:bg-white/5 px-4 py-3 text-sm">
            <b>{sel.length} incidencia(s) seleccionada(s)</b>
            {sameUnit ? (
              <Button onClick={() => setNewOt({ unit: selUnit, ids: sel })} className="rounded-xl bg-brand-navy text-white gap-1.5"><ClipboardPlus size={15} /> Crear OT con ellas</Button>
            ) : <span className="text-amber-700">Una OT es de una sola unidad: selecciona incidencias de la misma unidad.</span>}
            <button type="button" className="text-slate-500 underline" onClick={() => setSel([])}>Quitar selección</button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0f1115]/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10">
                  <th className="pl-4 py-3 w-8" /><th className="px-2">Unidad</th><th className="px-2">Incidencia</th><th className="px-2">Prioridad</th><th className="px-2">Estado</th><th className="px-2">Reportada</th><th className="px-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="text-center py-12 text-slate-400">Cargando...</td></tr>
                  : shown.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-slate-400">{rows.length ? "No hay incidencias con ese filtro." : "No hay incidencias anotadas."}</td></tr>
                    : shown.map((i) => (
                      <tr key={i.id} className="border-b border-slate-100 dark:border-white/5">
                        <td className="pl-4 py-3">{i.status === "ABIERTA" && <input type="checkbox" className="accent-brand-navy h-4 w-4" checked={sel.includes(Number(i.id))} onChange={() => toggle(i)} aria-label="Seleccionar" />}</td>
                        <td className="px-2 font-bold whitespace-nowrap">{i.unit_code}</td>
                        <td className="px-2 min-w-[220px]">
                          <span className="text-slate-900 dark:text-white">{i.title}</span>
                          {i.failure_system && <span className="text-xs text-slate-400"> · {FAILURE[i.failure_system]}</span>}
                          {i.description && <span className="block text-xs text-slate-500">{i.description}</span>}
                          {i.close_note && <span className="block text-xs text-slate-500">Descartada: {i.close_note}</span>}
                        </td>
                        <td className={`px-2 font-bold ${PRIORITY[i.priority]?.cls}`}>{PRIORITY[i.priority]?.label}</td>
                        <td className="px-2">
                          <Chip map={INC_STATUS} value={i.status} />
                          {i.work_order_number && <button type="button" onClick={() => navigate(`/maintenance?ot=${i.work_order_id}`)} className="block text-xs font-mono text-brand-navy dark:text-sky-300 underline mt-0.5">{i.work_order_number}</button>}
                        </td>
                        <td className="px-2 text-slate-500 whitespace-nowrap">{fmtDateTime(i.created_at)}<span className="block text-xs">{i.reported_by || "—"}</span></td>
                        <td className="px-2 pr-4 text-right whitespace-nowrap">
                          {i.status === "ABIERTA" && (
                            <span className="inline-flex gap-1">
                              <Button size="sm" variant="outline" className="rounded-lg gap-1" onClick={() => setNewOt({ unit: i.unit_id, ids: [Number(i.id)] })}><ClipboardPlus size={13} /> OT</Button>
                              {role.isSupervisor && <Button size="sm" variant="outline" className="rounded-lg text-red-600" onClick={() => setDiscard(i)}>Descartar</Button>}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>{showNew && <NewIncident units={units} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}</AnimatePresence>
      <AnimatePresence>{discard && <Discard inc={discard} onClose={() => setDiscard(null)} onSaved={() => { setDiscard(null); load(); }} />}</AnimatePresence>
      <AnimatePresence>
        {newOt && <NewWorkOrder presetUnitId={newOt.unit} presetIncidentIds={newOt.ids} onClose={() => setNewOt(null)} onCreated={(wo) => { setNewOt(null); setSel([]); navigate(`/maintenance?ot=${wo.id}`); }} />}
      </AnimatePresence>
    </PageLayout>
  );
}
