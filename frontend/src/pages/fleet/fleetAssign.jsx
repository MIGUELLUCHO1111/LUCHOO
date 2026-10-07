import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Flag, Phone, Users, PauseCircle, AlertTriangle, ChevronRight, History } from "lucide-react";
import { fleetService, resolveFleetFileUrl } from "@/services";
import { Button } from "@/components/ui/button";
import { inputCls, initials, fmtDate, fmtDateTime } from "./fleetParts";

// Bloques de la ficha para frente, conductor y equipo parado
// (058_fleet_frente_conductores.sql, pedido de Lguerra 07/10/2026).

const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });

const Modal = ({ title, icon: Icon, onClose, children }) =>
  createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#111216] border border-slate-100 dark:border-white/10 shadow-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="flex items-center gap-2.5 font-display text-xl text-brand-navy dark:text-white">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy text-white"><Icon size={15} /></span> {title}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );

// Casilla clicable de la seccion Estado operativo.
const Tile = ({ icon: Icon, label, value, sub, warn, onClick, tileCls = "bg-brand-navy" }) => (
  <motion.button type="button" disabled={!onClick} onClick={onClick} whileHover={onClick ? { y: -2 } : undefined}
    className={`group w-full flex items-center gap-3 min-w-0 rounded-2xl p-2 -m-2 text-left transition-colors ${onClick ? "hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer" : "cursor-default"}`}>
    <span className={`h-10 w-10 rounded-xl text-white flex items-center justify-center shrink-0 shadow-md ${warn ? "bg-amber-500" : tileCls}`}><Icon size={16} /></span>
    <span className="min-w-0 flex-1">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`block text-sm font-extrabold truncate ${warn ? "text-amber-600" : "text-brand-navy dark:text-white"}`}>{value}</span>
      {sub && <span className="block text-[10px] text-slate-500 truncate">{sub}</span>}
    </span>
    {onClick && <span className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-300 group-hover:bg-brand-navy group-hover:text-white transition-colors shrink-0"><ChevronRight size={14} /></span>}
  </motion.button>
);

// ---------- Conductor ----------
const licState = (c) => {
  if (!c?.license_expires_at) return null;
  const n = Number(c.license_days_left);
  if (n < 0) return { txt: `Licencia vencida hace ${Math.abs(n)} d`, cls: "text-red-600" };
  if (n <= 30) return { txt: `Licencia vence en ${n} d`, cls: "text-amber-600" };
  return { txt: `Licencia vigente hasta ${fmtDate(c.license_expires_at)}`, cls: "text-emerald-600" };
};

export const DriverTile = ({ unit, onChanged }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [drivers, setDrivers] = useState(null);
  const [sel, setSel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const c = unit.conductor;
  const lic = licState(c);
  useEffect(() => {
    if (!open || drivers) return;
    fleetService.listarConductores().then((d) => setDrivers((d || []).filter((x) => x.is_active))).catch((e) => setError(e.message));
  }, [open, drivers]);
  const save = async () => {
    setSaving(true);
    setError(null);
    try { await fleetService.asignarConductor(unit.id, sel ? Number(sel) : null); setOpen(false); await onChanged(); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };
  return (
    <>
      <Tile
        icon={Users}
        label="Conductor"
        value={c ? c.full_name : unit.driver_name || "Sin asignar"}
        sub={c ? (lic ? lic.txt : c.phone || "Del registro de conductores") : unit.driver_name ? "Sin conductor del registro" : null}
        warn={!c && !unit.driver_name}
        tileCls={lic?.cls === "text-red-600" ? "bg-red-600" : "bg-brand-navy"}
        onClick={unit.puede_editar ? () => { setSel(c ? String(c.driver_id) : ""); setError(null); setOpen(true); } : null}
      />
      <AnimatePresence>
        {open && (
          <Modal title="Conductor de la unidad" icon={Users} onClose={() => setOpen(false)}>
            {c && (
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] p-3 mb-4">
                <span className="h-12 w-12 rounded-xl overflow-hidden bg-brand-navy text-white flex items-center justify-center font-bold shrink-0">
                  {c.photo_url ? <img src={resolveFleetFileUrl(c.photo_url)} alt={c.full_name} className="h-full w-full object-cover" /> : initials(c.full_name)}
                </span>
                <div className="min-w-0">
                  <p className="font-extrabold text-brand-navy dark:text-white">{c.full_name}</p>
                  {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-xs font-bold text-brand-navy dark:text-sky-300"><Phone size={12} /> {c.phone}</a>}
                  {lic && <p className={`text-xs font-bold ${lic.cls}`}>{lic.txt}</p>}
                  <p className="text-[10px] text-slate-500">Desde {fmtDateTime(c.started_at)}</p>
                </div>
              </div>
            )}
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Elegir conductor
              <select value={sel} onChange={(e) => setSel(e.target.value)} className={`${inputCls} mt-1`}>
                <option value="">ROTATIVO (sin conductor fijo)</option>
                {(drivers || []).map((d) => <option key={d.id} value={d.id}>{d.full_name}{d.cedula ? ` · ${d.cedula}` : ""}{d.unidades.length ? ` · maneja ${d.unidades.map((u) => u.code).join(", ")}` : ""}</option>)}
              </select>
            </label>
            {drivers && !drivers.length && <p className="mt-2 text-xs text-amber-600 font-bold">Todavía no hay conductores registrados.</p>}
            <button type="button" onClick={() => navigate("/fleet/drivers")} className="mt-2 text-xs font-bold text-brand-navy dark:text-sky-300 hover:underline">Ir a Conductores (registrar uno nuevo) →</button>
            {unit.conductores_historial?.length > 0 && (
              <div className="mt-4">
                <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5"><History size={12} /> Historial</p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {unit.conductores_historial.map((h) => (
                    <li key={h.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] px-3 py-1.5 text-xs">
                      <b className="text-slate-700 dark:text-slate-200 truncate">{h.full_name}</b>
                      <span className="text-slate-500 shrink-0">{fmtDate(String(h.started_at).slice(0, 10))} → {h.ended_at ? fmtDate(String(h.ended_at).slice(0, 10)) : "hoy"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {error && <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-red-600"><AlertTriangle size={14} /> {error}</p>}
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={saving} onClick={save} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">{saving ? "Guardando…" : "Guardar"}</Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
};

// ---------- Frente / asignacion ----------
export const FrenteTile = ({ unit, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [usados, setUsados] = useState([]);
  const [f, setF] = useState({ frente: "", contrato: "", started_at: hoy(), note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fr = unit.frente;
  const abrir = () => {
    setF({ frente: fr?.frente || "", contrato: fr?.contrato || "", started_at: hoy(), note: "" });
    setError(null);
    setOpen(true);
    fleetService.listarFrentes().then((d) => setUsados(d || [])).catch(() => {});
  };
  const save = async (quitar = false) => {
    if (!quitar && !f.frente.trim()) return setError("Escribe el frente (o usa \"Quitar asignación\").");
    setSaving(true);
    setError(null);
    try { await fleetService.asignarFrente(unit.id, quitar ? { frente: "", started_at: f.started_at } : f); setOpen(false); await onChanged(); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };
  return (
    <>
      <Tile icon={Flag} label="Frente / asignación" value={fr ? fr.frente : "Sin frente asignado"}
        sub={fr ? [fr.contrato && `Contrato ${fr.contrato}`, `desde ${fmtDate(fr.started_at)}`].filter(Boolean).join(" · ") : unit.profile?.assigned_zone ? `Zona: ${unit.profile.assigned_zone}` : null}
        warn={!fr} onClick={unit.puede_editar ? abrir : null} />
      <AnimatePresence>
        {open && (
          <Modal title="Frente / asignación" icon={Flag} onClose={() => setOpen(false)}>
            <p className="text-xs text-slate-500 mb-3">A qué frente, contrato o sitio está asignada la unidad. Al cambiarlo, el anterior queda en el historial.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="sm:col-span-2 text-xs font-bold text-slate-600 dark:text-slate-300">Frente *
                <input list="frentes-usados" autoFocus value={f.frente} onChange={(e) => setF({ ...f, frente: e.target.value.toUpperCase() })} placeholder="Ej. CAMPO BOSCÁN, REFINERÍA EL PALITO" className={`${inputCls} mt-1`} />
                <datalist id="frentes-usados">{usados.map((u) => <option key={u.frente} value={u.frente}>{u.unidades} unidad(es)</option>)}</datalist>
              </label>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Contrato
                <input value={f.contrato} onChange={(e) => setF({ ...f, contrato: e.target.value })} placeholder="Ej. PDVSA-Chevron" className={`${inputCls} mt-1`} />
              </label>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Desde
                <input type="date" value={f.started_at} onChange={(e) => setF({ ...f, started_at: e.target.value })} className={`${inputCls} mt-1`} />
              </label>
              <label className="sm:col-span-2 text-xs font-bold text-slate-600 dark:text-slate-300">Nota
                <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Opcional" className={`${inputCls} mt-1`} />
              </label>
            </div>
            {unit.frentes_historial?.length > 0 && (
              <div className="mt-4">
                <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5"><History size={12} /> Historial</p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {unit.frentes_historial.map((h) => (
                    <li key={h.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] px-3 py-1.5 text-xs">
                      <b className="text-slate-700 dark:text-slate-200 truncate">{h.frente}{h.contrato ? ` · ${h.contrato}` : ""}</b>
                      <span className="text-slate-500 shrink-0">{fmtDate(h.started_at)} → {h.ended_at ? fmtDate(h.ended_at) : "hoy"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {error && <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-red-600"><AlertTriangle size={14} /> {error}</p>}
            <div className="flex flex-wrap justify-end gap-2 mt-5">
              {fr && <Button variant="outline" disabled={saving} className="rounded-xl mr-auto text-red-600" onClick={() => save(true)}>Quitar asignación</Button>}
              <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={saving} onClick={() => save(false)} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">{saving ? "Guardando…" : "Guardar"}</Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
};

// ---------- Equipo parado ----------
// Dias desde la ultima vez que el GPS lo vio encendido o andando.
export const paradaInfo = (p) => {
  if (!p) return null;
  if (p.alerta) return { tone: "alerta", txt: `Parada hace ${p.dias} días`, cls: "bg-violet-600 text-white" };
  if (p.dias >= 7) return { tone: "aviso", txt: `Sin moverse hace ${p.dias} días`, cls: "bg-violet-500/10 text-violet-700 dark:text-violet-300" };
  return null;
};

export const ParadaTile = ({ parada }) => {
  if (!parada) return null;
  const info = paradaInfo(parada);
  const value = parada.dias === 0 ? "Se movió hoy" : parada.dias === 1 ? "Se movió ayer" : `Sin moverse hace ${parada.dias} días`;
  return (
    <Tile icon={PauseCircle} label="Último movimiento (GPS)" value={value}
      sub={parada.nunca_se_movio ? `No se ha visto moverse desde ${fmtDate(String(parada.desde).slice(0, 10))} (inicio de datos)` : `${fmtDateTime(parada.desde)} · alerta de equipo parado a los ${parada.dias_alerta} días`}
      tileCls={info?.tone === "alerta" ? "bg-violet-600" : info ? "bg-violet-500" : "bg-emerald-600"} />
  );
};
