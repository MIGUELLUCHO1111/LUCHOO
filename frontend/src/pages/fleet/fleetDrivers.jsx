import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, Search, Phone, IdCard, Pencil, UserX, Truck, ChevronRight, Car } from "lucide-react";
import { fleetService } from "@/services";
import { getCurrentProfile } from "@/services/api";
import { PageLayout } from "@/components/layout/PageLayout";
import { useConfirm } from "@/context";
import { inputCls } from "./fleetParts";
import DriverDocsBars from "./fleetDriverDocsBars";
import { licencia, cartaMedica, docOk, photoOk, DriverForm, DocBox, DriverFleetBadge, DriverPhoto, driverInFleet, DRIVER_DOCS, certPesada, politica, autorizacion } from "./fleetDriverParts";

// Conductores de la flota (pedido de Lguerra, 07/10/2026): registro con
// cedula, telefono, licencia y su vencimiento, foto, carta medica, a que flota
// pertenece y que unidades maneja. Cada tarjeta abre la ficha del conductor
// (/fleet/drivers/:id). Solo el admin registra/edita.
// Politica sin firmar, o certificado de flota pesada faltante / vencido / por vencer.
const pendiente = (d) => ["falta", "vencida", "por_vencer"].includes(autorizacion(d).key) || politica(d).key === "falta" || ["falta", "vencida", "por_vencer"].includes(certPesada(d).key);
const FLEET_BAND = { LIVIANA: "bg-brand-navy", PESADA: "bg-[#FFCD11]", AMBAS: "bg-gradient-to-r from-brand-navy from-50% to-[#FFCD11] to-50%" };

const DriverCard = ({ d, isAdmin, onEdit, onRemove, onPhoto, onDoc, i }) => {
  const navigate = useNavigate();
  const stop = (e) => e.stopPropagation();
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} whileHover={{ y: -3 }}
      onClick={() => navigate(`/fleet/drivers/${d.id}`)} role="link" title="Abrir la ficha del conductor"
      className={`group cursor-pointer overflow-hidden rounded-3xl border bg-white/90 dark:bg-[#0f1115]/80 hover:shadow-xl hover:shadow-brand-navy/10 transition-shadow ${d.is_active ? "border-slate-100 dark:border-white/5" : "border-dashed border-slate-300 opacity-70"}`}>
      <div className={`h-1.5 ${FLEET_BAND[d.fleet_type] || "bg-slate-200 dark:bg-white/10"}`} />
      <div className="p-5">
        <div className="flex items-start gap-4">
          <DriverPhoto d={d} editable={isAdmin} onPhoto={(file) => onPhoto(d, file)} className="h-20 w-16 rounded-2xl text-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-display text-lg text-brand-navy dark:text-white leading-tight group-hover:underline">{d.full_name}</p>
              <span className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 group-hover:bg-brand-navy group-hover:text-white transition-colors shrink-0"><ChevronRight size={15} /></span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <DriverFleetBadge type={d.fleet_type} />
              {!d.is_active && <span className="inline-flex rounded-full bg-slate-200 dark:bg-white/10 px-2 py-0.5 text-[10px] font-black text-slate-600">INACTIVO</span>}
            </div>
            <div className="mt-1.5 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {d.cedula && <p className="flex items-center gap-1.5"><span className="inline-flex text-brand-navy dark:text-sky-300"><IdCard size={13} /></span> C.I. <b className="font-mono">{d.cedula}</b></p>}
              {d.phone && <a href={`tel:${d.phone}`} onClick={stop} className="flex items-center gap-1.5 font-bold text-brand-navy dark:text-sky-300 hover:underline"><Phone size={13} /> {d.phone}</a>}
              {(d.license_number || d.license_category) && <p className="text-slate-500">Licencia {d.license_category && <b>{d.license_category}</b>} {d.license_number && <span className="font-mono">N° {d.license_number}</span>}</p>}
            </div>
          </div>
        </div>
        <DriverDocsBars d={d} className="mt-3" />
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2" onClick={stop}>
          {DRIVER_DOCS.map((x) => (
            <DocBox key={x.kind} title={x.short} icon={x.icon} url={d[x.url]} mime={d[x.mime]} isAdmin={isAdmin} onUpload={(file) => onDoc(d, x.kind, file)} estado={x.estado(d)} />
          ))}
        </div>
        <div className="mt-3">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5">Unidades que maneja</p>
          {d.unidades.length ? (
            <div className="flex flex-wrap gap-1.5">
              {d.unidades.map((u) => (
                <motion.button key={u.unit_id} type="button" whileHover={{ y: -2 }} onClick={(e) => { stop(e); navigate(`/fleet/${u.unit_id}`); }} title={`Abrir la ficha de ${u.code}`}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-black transition-colors ${u.fleet_type === "PESADA" ? "bg-[#FFCD11]/25 text-slate-800 dark:text-amber-200 hover:bg-[#FFCD11]" : "bg-brand-navy/10 text-brand-navy dark:bg-white/10 dark:text-sky-200 hover:bg-brand-navy hover:text-white"}`}>
                  {u.fleet_type === "PESADA" ? <Truck size={12} /> : <Car size={12} />} {u.code}
                </motion.button>
              ))}
            </div>
          ) : <p className="text-xs text-slate-400">Sin unidad asignada · ábrelo para asignarle una.</p>}
        </div>
        {isAdmin && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex justify-end gap-2" onClick={stop}>
            <button type="button" onClick={() => onEdit(d)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-brand-navy dark:text-sky-300 hover:bg-brand-navy/5"><Pencil size={13} /> Editar</button>
            <button type="button" onClick={() => onRemove(d)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"><UserX size={13} /> Dar de baja</button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const FleetDrivers = () => {
  const isAdmin = getCurrentProfile() === "admin";
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const flota = ["LIVIANA", "PESADA", "sin"].includes(params.get("flota")) ? params.get("flota") : "todas";
  const setFlota = (k) => setParams(k === "todas" ? {} : { flota: k }, { replace: true });
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [form, setForm] = useState(null); // null | "nuevo" | conductor

  const load = () => fleetService.listarConductores().then((d) => setDrivers(Array.isArray(d) ? d : [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const deFlota = useMemo(() => drivers.filter((d) => driverInFleet(d, flota)), [drivers, flota]);
  const flotaCounts = useMemo(() => ({
    todas: drivers.length,
    LIVIANA: drivers.filter((d) => driverInFleet(d, "LIVIANA")).length,
    PESADA: drivers.filter((d) => driverInFleet(d, "PESADA")).length,
    sin: drivers.filter((d) => !d.fleet_type).length,
  }), [drivers]);
  const counts = useMemo(() => {
    const c = { todos: deFlota.length, vencida: 0, por_vencer: 0, medica: 0, pendientes: 0, sin_unidad: 0 };
    deFlota.forEach((d) => { const k = licencia(d).key; if (c[k] !== undefined) c[k] += 1; if (!d.unidades.length) c.sin_unidad += 1; if (["vencida", "por_vencer"].includes(cartaMedica(d).key)) c.medica += 1; if (pendiente(d)) c.pendientes += 1; });
    return c;
  }, [deFlota]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return deFlota.filter((d) => {
      if (filtro === "vencida" || filtro === "por_vencer") { if (licencia(d).key !== filtro) return false; }
      if (filtro === "sin_unidad" && d.unidades.length) return false;
      if (filtro === "medica" && !["vencida", "por_vencer"].includes(cartaMedica(d).key)) return false;
      if (filtro === "pendientes" && !pendiente(d)) return false;
      if (!t) return true;
      return [d.full_name, d.cedula, d.phone, d.license_number, ...d.unidades.map((u) => u.code)].some((v) => String(v || "").toLowerCase().includes(t));
    });
  }, [deFlota, q, filtro]);

  const remove = async (d) => {
    if (!(await confirm(`¿Dar de baja a ${d.full_name}?${d.unidades.length ? ` Sus unidades (${d.unidades.map((u) => u.code).join(", ")}) quedarán como ROTATIVO.` : ""}`, { title: "Dar de baja", confirmText: "Dar de baja" }))) return;
    try { await fleetService.eliminarConductor(d.id); load(); } catch (e) { setError(e.message); }
  };
  const doc = async (d, kind, file) => {
    if (!docOk(file)) return setError("El archivo debe ser una foto (JPG, PNG, WEBP) o un PDF de hasta 10 MB.");
    try { await fleetService.subirDocumentoConductor(d.id, kind, file); setError(null); load(); } catch (e) { setError(e.response?.data?.message || e.message); }
  };
  const photo = async (d, file) => {
    if (!photoOk(file)) return setError("La foto debe ser JPG, PNG o WEBP de hasta 8 MB.");
    try { await fleetService.subirFotoConductor(d.id, file); setError(null); load(); } catch (e) { setError(e.response?.data?.message || e.message); }
  };

  const FLOTAS = [
    ["todas", "Todos los conductores", Users, "bg-slate-700"],
    ["LIVIANA", "Flota Liviana", Car, "bg-brand-navy"],
    ["PESADA", "Flota Pesada", Truck, "bg-[#FFCD11]"],
  ];
  const FILTROS = [["todos", "Todos"], ["vencida", "Licencia vencida"], ["por_vencer", "Licencia por vencer"], ["medica", "Carta médica vencida o por vencer"], ["pendientes", "Autorización, política o certificado pendiente"], ["sin_unidad", "Sin unidad"]];
  return (
    <PageLayout back={{ to: "/fleet", label: "Fichas de Vehículos" }} icon={Users} title="Conductores" subtitle={`FLOTA • ${drivers.length} CONDUCTOR(ES) REGISTRADO(S)`} maxWidth="max-w-[1400px]">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {FLOTAS.map(([k, l, Icon, bg]) => {
          const on = flota === k;
          const pesada = k === "PESADA";
          return (
            <motion.button key={k} type="button" onClick={() => setFlota(k)} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
              className={`relative overflow-hidden flex items-center gap-3 rounded-2xl p-4 text-left transition-all ${on ? `${bg} ${pesada ? "text-slate-900" : "text-white"} shadow-lg` : "bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-brand-navy/40"}`}>
              <span className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${on ? (pesada ? "bg-slate-900/10" : "bg-white/15") : `${bg} ${pesada ? "text-slate-900" : "text-white"}`}`}><Icon size={20} /></span>
              <span className="min-w-0">
                <span className="block font-display text-lg leading-tight">{l}</span>
                <span className={`block text-xs font-bold ${on ? "opacity-80" : "text-slate-500"}`}>{flotaCounts[k]} conductor(es)</span>
              </span>
            </motion.button>
          );
        })}
      </div>
      {flotaCounts.sin > 0 && flota === "todas" && (
        <button type="button" onClick={() => setFlota("sin")} className="mb-4 text-xs font-bold text-slate-500 hover:text-brand-navy hover:underline">
          {flotaCounts.sin} conductor(es) sin flota definida (sin unidad asignada) · ver
        </button>
      )}
      {flota === "sin" && (
        <button type="button" onClick={() => setFlota("todas")} className="mb-4 text-xs font-bold text-brand-navy dark:text-sky-300 hover:underline">Mostrando: sin flota definida · Quitar filtro</button>
      )}
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
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 mb-6">
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
            {shown.map((d, i) => <DriverCard key={d.id} d={d} i={i} isAdmin={isAdmin} onEdit={setForm} onRemove={remove} onPhoto={photo} onDoc={doc} />)}
          </div>
        )}
      <AnimatePresence>
        {form && <DriverForm driver={form === "nuevo" ? null : form} onClose={() => setForm(null)} onSaved={(id) => { const nuevo = form === "nuevo"; setForm(null); if (nuevo && id) navigate(`/fleet/drivers/${id}`); else load(); }} />}
      </AnimatePresence>
    </PageLayout>
  );
};

export default FleetDrivers;
