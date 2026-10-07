import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, Search, X, Phone, IdCard, Pencil, UserX, Camera, AlertTriangle, Truck } from "lucide-react";
import { fleetService, resolveFleetFileUrl } from "@/services";
import { getCurrentProfile } from "@/services/api";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { useConfirm } from "@/context";
import { inputCls, initials, fmtDate } from "./fleetParts";

// Conductores de la flota (pedido de Lguerra, 07/10/2026): registro con
// cedula, telefono, licencia y su vencimiento, foto, y que unidades maneja.
// Se asignan desde la ficha de cada unidad. Solo el admin registra/edita.
const licencia = (d) => {
  if (!d.license_expires_at) return { key: "sin", label: "Sin vencimiento registrado", cls: "bg-slate-100 text-slate-500 dark:bg-white/5" };
  const n = Number(d.license_days_left);
  if (n < 0) return { key: "vencida", label: `Licencia vencida hace ${Math.abs(n)} d`, cls: "bg-red-600 text-white" };
  if (n <= 30) return { key: "por_vencer", label: n === 0 ? "Licencia vence hoy" : `Licencia vence en ${n} d`, cls: "bg-[#FFCD11] text-slate-900" };
  return { key: "vigente", label: `Licencia vigente · ${fmtDate(d.license_expires_at)}`, cls: "bg-emerald-600 text-white" };
};

const DriverForm = ({ driver, onClose, onSaved }) => {
  const [f, setF] = useState({
    full_name: driver?.full_name || "", cedula: driver?.cedula || "", phone: driver?.phone || "",
    license_number: driver?.license_number || "", license_category: driver?.license_category || "",
    license_expires_at: driver?.license_expires_at || "", notes: driver?.notes || "", is_active: driver ? driver.is_active : true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async (e) => {
    e.preventDefault();
    if (!f.full_name.trim()) return setError("Indica el nombre del conductor.");
    setSaving(true);
    setError(null);
    try {
      await fleetService.guardarConductor({ ...(driver ? { id: driver.id } : {}), ...f });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.form onSubmit={save} initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#111216] border border-slate-100 dark:border-white/10 shadow-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="flex items-center gap-2.5 font-display text-xl text-brand-navy dark:text-white">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy text-white">{driver ? <Pencil size={15} /> : <Plus size={16} />}</span>
            {driver ? "Editar conductor" : "Nuevo conductor"}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2 text-xs font-bold text-slate-600 dark:text-slate-300">Nombre y apellido *
            <input autoFocus value={f.full_name} onChange={(e) => set("full_name", e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Cédula
            <input value={f.cedula} onChange={(e) => set("cedula", e.target.value.toUpperCase())} placeholder="V-12345678" className={`${inputCls} mt-1 font-mono`} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Teléfono
            <input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0414-1234567" className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">N° de licencia
            <input value={f.license_number} onChange={(e) => set("license_number", e.target.value.toUpperCase())} className={`${inputCls} mt-1 font-mono`} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Grado de licencia
            <input list="grados-licencia" value={f.license_category} onChange={(e) => set("license_category", e.target.value.toUpperCase())} placeholder="Ej. 5TA" className={`${inputCls} mt-1`} />
            <datalist id="grados-licencia">{["2DA", "3RA", "4TA", "5TA"].map((g) => <option key={g} value={g} />)}</datalist>
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Vencimiento de la licencia
            <input type="date" value={f.license_expires_at} onChange={(e) => set("license_expires_at", e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 self-end pb-2">
            <input type="checkbox" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} className="h-4 w-4" /> Activo
          </label>
          <label className="sm:col-span-2 text-xs font-bold text-slate-600 dark:text-slate-300">Notas
            <textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputCls} mt-1 resize-none`} />
          </label>
        </div>
        {error && <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-red-600"><AlertTriangle size={14} /> {error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">{saving ? "Guardando…" : driver ? "Guardar cambios" : "Registrar conductor"}</Button>
        </div>
      </motion.form>
    </motion.div>,
    document.body,
  );
};

const DriverCard = ({ d, isAdmin, onEdit, onRemove, onPhoto, i }) => {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const lic = licencia(d);
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} whileHover={{ y: -3 }}
      className={`rounded-3xl border bg-white/90 dark:bg-[#0f1115]/80 p-5 hover:shadow-xl hover:shadow-brand-navy/10 transition-shadow ${d.is_active ? "border-slate-100 dark:border-white/5" : "border-dashed border-slate-300 opacity-70"}`}>
      <div className="flex items-start gap-4">
        <button type="button" disabled={!isAdmin} onClick={() => fileRef.current?.click()} title={isAdmin ? "Cambiar la foto" : ""}
          className="group relative h-16 w-16 rounded-2xl overflow-hidden shrink-0 bg-brand-navy text-white flex items-center justify-center font-display text-xl shadow-md">
          {d.photo_url ? <img src={resolveFleetFileUrl(d.photo_url)} alt={d.full_name} className="h-full w-full object-cover" /> : initials(d.full_name)}
          {isAdmin && <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera size={18} /></span>}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) onPhoto(d, file); e.target.value = ""; }} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg text-brand-navy dark:text-white leading-tight">{d.full_name}</p>
          {!d.is_active && <span className="inline-flex rounded-full bg-slate-200 dark:bg-white/10 px-2 py-0.5 text-[10px] font-black text-slate-600">INACTIVO</span>}
          <div className="mt-1.5 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {d.cedula && <p className="flex items-center gap-1.5"><span className="inline-flex text-brand-navy dark:text-sky-300"><IdCard size={13} /></span> C.I. <b className="font-mono">{d.cedula}</b></p>}
            {d.phone && <a href={`tel:${d.phone}`} className="flex items-center gap-1.5 font-bold text-brand-navy dark:text-sky-300 hover:underline"><Phone size={13} /> {d.phone}</a>}
            {(d.license_number || d.license_category) && <p className="text-slate-500">Licencia {d.license_category && <b>{d.license_category}</b>} {d.license_number && <span className="font-mono">N° {d.license_number}</span>}</p>}
          </div>
        </div>
      </div>
      <p className={`mt-3 rounded-xl px-3 py-1.5 text-xs font-extrabold ${lic.cls}`}>{lic.label}</p>
      <div className="mt-3">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5">Unidades que maneja</p>
        {d.unidades.length ? (
          <div className="flex flex-wrap gap-1.5">
            {d.unidades.map((u) => (
              <motion.button key={u.unit_id} type="button" whileHover={{ y: -2 }} onClick={() => navigate(`/fleet/${u.unit_id}`)}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-navy/10 text-brand-navy dark:bg-white/10 dark:text-sky-200 px-2 py-1 text-[11px] font-black hover:bg-brand-navy hover:text-white transition-colors">
                <Truck size={12} /> {u.code}
              </motion.button>
            ))}
          </div>
        ) : <p className="text-xs text-slate-400">Sin unidad asignada (se asigna desde la ficha de la unidad).</p>}
      </div>
      {isAdmin && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex justify-end gap-2">
          <button type="button" onClick={() => onEdit(d)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-brand-navy dark:text-sky-300 hover:bg-brand-navy/5"><Pencil size={13} /> Editar</button>
          <button type="button" onClick={() => onRemove(d)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"><UserX size={13} /> Dar de baja</button>
        </div>
      )}
    </motion.div>
  );
};

const FleetDrivers = () => {
  const isAdmin = getCurrentProfile() === "admin";
  const confirm = useConfirm();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [form, setForm] = useState(null); // null | "nuevo" | conductor

  const load = () => fleetService.listarConductores().then((d) => setDrivers(Array.isArray(d) ? d : [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { todos: drivers.length, vencida: 0, por_vencer: 0, sin_unidad: 0 };
    drivers.forEach((d) => { const k = licencia(d).key; if (c[k] !== undefined) c[k] += 1; if (!d.unidades.length) c.sin_unidad += 1; });
    return c;
  }, [drivers]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return drivers.filter((d) => {
      if (filtro === "vencida" || filtro === "por_vencer") { if (licencia(d).key !== filtro) return false; }
      if (filtro === "sin_unidad" && d.unidades.length) return false;
      if (!t) return true;
      return [d.full_name, d.cedula, d.phone, d.license_number, ...d.unidades.map((u) => u.code)].some((v) => String(v || "").toLowerCase().includes(t));
    });
  }, [drivers, q, filtro]);

  const remove = async (d) => {
    if (!(await confirm(`¿Dar de baja a ${d.full_name}?${d.unidades.length ? ` Sus unidades (${d.unidades.map((u) => u.code).join(", ")}) quedarán como ROTATIVO.` : ""}`, { title: "Dar de baja", confirmText: "Dar de baja" }))) return;
    try { await fleetService.eliminarConductor(d.id); load(); } catch (e) { setError(e.message); }
  };
  const photo = async (d, file) => {
    try { await fleetService.subirFotoConductor(d.id, file); load(); } catch (e) { setError(e.response?.data?.message || e.message); }
  };

  const FILTROS = [["todos", "Todos"], ["vencida", "Licencia vencida"], ["por_vencer", "Licencia por vencer"], ["sin_unidad", "Sin unidad"]];
  return (
    <PageLayout back={{ to: "/fleet", label: "Fichas de Vehículos" }} icon={Users} title="Conductores" subtitle={`FLOTA • ${drivers.length} CONDUCTOR(ES) REGISTRADO(S)`} maxWidth="max-w-[1400px]">
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy dark:text-sky-300"><Search size={18} /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, cédula, teléfono, licencia o unidad…" className={`${inputCls} pl-11 h-12 text-base shadow-sm`} />
        </div>
        {isAdmin && (
          <motion.button type="button" onClick={() => setForm("nuevo")} whileHover={{ y: -3, scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="group relative overflow-hidden h-12 px-7 rounded-2xl inline-flex items-center justify-center gap-3 text-base font-black text-slate-900 bg-gradient-to-r from-[#FFD84D] via-[#FFCD11] to-[#E6B400] shadow-lg shadow-amber-400/40 shrink-0">
            <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-navy text-white transition-transform duration-300 group-hover:rotate-90"><Plus size={18} strokeWidth={3} /></span>
            Nuevo conductor
          </motion.button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        {FILTROS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFiltro(k)}
            className={`relative h-11 rounded-xl text-sm font-extrabold transition-colors ${filtro === k ? "text-white" : "bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-navy/40"}`}>
            {filtro === k && <motion.span layoutId="drv-filter" className="absolute inset-0 rounded-xl bg-brand-navy shadow-md shadow-brand-navy/20" />}
            <span className="relative">{l} <span className="opacity-70 text-xs">{counts[k]}</span></span>
          </button>
        ))}
      </div>
      {error && <p className="mb-4 text-sm font-bold text-red-600">{error}</p>}
      {loading ? <p className="text-center text-slate-400 py-16">Cargando conductores…</p>
        : shown.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16">
            <span className="h-14 w-14 rounded-2xl bg-brand-navy text-white flex items-center justify-center mb-3"><Users size={24} /></span>
            <p className="font-extrabold text-brand-navy dark:text-white">{drivers.length ? "Ningún conductor con ese filtro" : "Todavía no hay conductores registrados"}</p>
            {isAdmin && !drivers.length && <p className="text-sm text-slate-500 mt-1">Usa "Nuevo conductor" para registrar el primero.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
            {shown.map((d, i) => <DriverCard key={d.id} d={d} i={i} isAdmin={isAdmin} onEdit={setForm} onRemove={remove} onPhoto={photo} />)}
          </div>
        )}
      <AnimatePresence>{form && <DriverForm driver={form === "nuevo" ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}</AnimatePresence>
    </PageLayout>
  );
};

export default FleetDrivers;
