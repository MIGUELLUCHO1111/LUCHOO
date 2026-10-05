import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, Search, Settings2, FileWarning, MapPin, User, Wrench, X, LayoutGrid, UserCog, ClipboardList, ShieldCheck, Briefcase, CircleCheck, Ban, ChevronRight } from "lucide-react";
import { fleetService, resolveFleetFileUrl } from "@/services";
import { getCurrentProfile } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { STATUS, statusOf, statusKeyOf, gpsState, PlateBadge, VehicleIcon, inputCls } from "./fleetParts";
import { useFamilies } from "./fleetArt";
import { fichaChecklist, CHECK_LABELS } from "./fleetCompleteness";
import AssignManagersModal from "./fleetManagers";

// Icono y color solido de cada indicador (pedido de Lguerra, 05/10/2026: que resalte).
const KPI_ICON = { total: Truck, OPERATIVO_CONTRATO: Briefcase, DISPONIBLE: CircleCheck, FUERA_DE_SERVICIO: Ban, docs: FileWarning };
const Kpi = ({ id, label, value, total, tile = "bg-brand-navy", tileText = "text-white", tone = "text-brand-navy dark:text-white", active, onClick }) => {
  const Icon = KPI_ICON[id] || Truck;
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <motion.button
      type="button"
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`text-left rounded-2xl border p-4 transition-colors ${active ? "border-brand-navy ring-2 ring-brand-navy/20 bg-white dark:bg-[#0f1115]" : "border-slate-100 dark:border-white/5 bg-white/80 dark:bg-[#0f1115]/80 hover:border-slate-200 dark:hover:border-white/10"}`}
    >
      <div className="flex items-center gap-3">
        <span className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-md ${tileText} ${tile}`}><Icon size={18} /></span>
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 leading-tight">{label}</p>
          <p className={`font-display text-2xl leading-tight ${tone}`}>{value}</p>
        </div>
      </div>
      {id !== "total" && (
        <div className="mt-3 flex items-center gap-2">
          <span className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
            <motion.span initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} className={`block h-full rounded-full ${tile}`} />
          </span>
          <span className="text-[10px] font-bold text-slate-500">{pct}%</span>
        </div>
      )}
    </motion.button>
  );
};

const AjustesModal = ({ onClose }) => {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fleetService.getAjustes().then(setForm).catch((e) => setError(e.message));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await fleetService.guardarAjustes(form);
      onClose(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    ["MAINT_INTERVAL_LIVIANA", "Mantenimiento Flota Liviana", "km"],
    ["MAINT_INTERVAL_PESADA", "Mantenimiento Flota Pesada", "km"],
    ["DOC_ALERT_DAYS", "Avisar vencimiento de documentos con", "días"],
  ];

  return (
    createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => onClose(false)}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white dark:bg-[#111216] border border-slate-100 dark:border-white/10 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg text-slate-900 dark:text-white">Intervalos de mantenimiento</h3>
          <button onClick={() => onClose(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-500 mb-5">Valen para todas las unidades de cada flota. Una ficha puede tener su propio intervalo.</p>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {!form ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : (
          <div className="space-y-4">
            {fields.map(([k, label, unit]) => (
              <label key={k} className="block">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}</span>
                <div className="mt-1 flex items-center gap-2">
                  <input type="number" min="1" value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={inputCls} />
                  <span className="text-xs text-slate-400 w-10">{unit}</span>
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" className="rounded-xl" onClick={() => onClose(false)}>Cancelar</Button>
          <Button disabled={saving || !form} onClick={save} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">{saving ? "Guardando…" : "Guardar"}</Button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
    )
  );
};

const InfoRow = ({ icon: Icon, children, warn = false }) => (
  <p className={`flex items-center gap-2 truncate ${warn ? "text-amber-600 font-bold" : "text-slate-700 dark:text-slate-200 font-medium"}`}>
    <span className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${warn ? "bg-amber-500/15 text-amber-600" : "bg-brand-navy/10 text-brand-navy dark:bg-white/10 dark:text-sky-300"}`}><Icon size={12} /></span>
    <span className="truncate">{children}</span>
  </p>
);

const UnitCard = ({ u, onOpen, i }) => {
  const st = statusOf(u);
  const ficha = fichaChecklist(u);
  const gps = gpsState(u.gps);
  const p = u.profile || {};
  const modelo = u.model_name ? [u.brand_name, u.model_name, u.version_name].filter(Boolean).join(" ") : [p.brand, p.model].filter(Boolean).join(" ");
  const docAlert = u.docs_expired > 0 ? "vencido" : u.docs_expiring > 0 ? "por vencer" : null;

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.015, 0.3) }}
      whileHover={{ y: -4 }}
      onClick={onOpen}
      className="group relative text-left rounded-3xl border border-slate-100 dark:border-white/5 bg-white/90 dark:bg-[#0f1115]/80 backdrop-blur-md p-5 overflow-hidden hover:shadow-xl hover:shadow-brand-navy/10 transition-shadow"
    >
      <span className={`absolute left-0 top-0 h-full w-1.5 ${st.bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PlateBadge plate={u.plate} size="sm" />
          <p className="mt-2 font-display text-lg text-brand-navy dark:text-white truncate">{u.code}</p>
          <p className={`text-xs truncate ${modelo || u.name ? "text-slate-600 dark:text-slate-300 font-semibold" : "text-amber-600 font-bold"}`}>{modelo || u.name || "Ficha técnica pendiente"}</p>
        </div>
        {u.model_photo ? (
          <img src={resolveFleetFileUrl(u.model_photo)} alt={modelo} loading="lazy" className="w-20 h-14 rounded-xl object-cover shrink-0 group-hover:scale-105 transition-transform" />
        ) : (
          <span className="h-14 w-20 rounded-xl bg-brand-navy/5 dark:bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-brand-navy/10 transition-colors">
            <VehicleIcon fleetType={u.fleet_type} className="w-14 h-10 text-brand-navy dark:text-sky-300 group-hover:scale-105 transition-transform" />
          </span>
        )}
      </div>

      <div className="mt-4 space-y-1.5 text-xs">
        <InfoRow icon={User} warn={!u.driver_name}>{u.driver_name || "Sin conductor"}</InfoRow>
        <InfoRow icon={MapPin}>{u.gps?.location_text || p.assigned_zone || "Sin ubicación"}</InfoRow>
        <InfoRow icon={UserCog} warn={!u.encargado}>
          {u.encargado ? `Encargado: ${u.encargado.nombre}` : "Sin encargado"}
          {u.soy_encargado && <span className="ml-1.5 rounded-full bg-brand-gold/25 text-amber-800 dark:text-brand-gold px-1.5 text-[9px] font-black">TUYA</span>}
        </InfoRow>
      </div>

      <div className="mt-4" title={ficha.items.filter((x) => !x.ok).map((x) => x.detail || x.label).join(" · ") || "Ficha completa"}>
        <div className="flex items-center justify-between text-[10px] font-extrabold mb-1">
          <span className="text-brand-navy dark:text-sky-200 uppercase tracking-widest">Ficha</span>
          <span className={`rounded-full px-1.5 py-0.5 ${ficha.complete ? "bg-emerald-500/15 text-emerald-700" : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300"}`}>{ficha.complete ? "Completa" : `${ficha.done} de ${ficha.total}`}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(ficha.pct, 3)}%` }} transition={{ duration: 0.6 }} className={`h-full rounded-full ${ficha.complete ? "bg-emerald-500" : ficha.pct >= 60 ? "bg-amber-500" : "bg-red-400"}`} />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${st.on} ${st.dot}`}>{st.short}</span>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${gps.cls}`}>
          <span className={`h-2 w-2 rounded-full ${gps.dot}`} />{gps.label}
        </span>
        <span className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-300 group-hover:bg-brand-navy group-hover:text-white transition-colors"><ChevronRight size={14} /></span>
      </div>
      {docAlert && (
        <p className={`mt-3 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold ${docAlert === "vencido" ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-700"}`}>
          <FileWarning size={13} /> Documento {docAlert}
        </p>
      )}
    </motion.button>
  );
};

const IncompleteBlock = ({ units, active, onFilter, onAssign }) => {
  const stats = useMemo(() => {
    const byKey = {};
    let incompletas = 0;
    units.forEach((u) => {
      const f = fichaChecklist(u);
      if (!f.complete) incompletas += 1;
      f.items.filter((x) => !x.ok).forEach((x) => { byKey[x.key] = (byKey[x.key] || 0) + 1; });
    });
    return { incompletas, byKey };
  }, [units]);
  const pct = units.length ? Math.round(((units.length - stats.incompletas) / units.length) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-100 dark:border-white/5 bg-white/90 dark:bg-[#0f1115]/80 backdrop-blur-md p-5 mb-5 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative w-16 h-16 shrink-0">
            <span className="block w-16 h-16">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" strokeWidth="4" className="stroke-slate-100 dark:stroke-white/10" />
                <motion.circle cx="18" cy="18" r="15" fill="none" strokeWidth="4" strokeLinecap="round" className={pct ? "stroke-emerald-500" : "stroke-transparent"} strokeDasharray="94.2" initial={{ strokeDashoffset: 94.2 }} animate={{ strokeDashoffset: 94.2 - (94.2 * pct) / 100 }} transition={{ duration: 1 }} />
              </svg>
            </span>
            <span className="absolute inset-0 flex items-center justify-center font-display text-sm text-brand-navy dark:text-white">{pct}%</span>
          </div>
          <div>
            <p className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.12em] text-brand-navy dark:text-sky-200">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-navy text-white dark:bg-sky-700"><ClipboardList size={13} /></span> Fichas incompletas
            </p>
            <p className="font-display text-2xl text-brand-navy dark:text-white mt-0.5">{stats.incompletas} <span className="text-sm text-slate-500 font-sans font-semibold">de {units.length} unidades · {units.length - stats.incompletas} completas</span></p>
          </div>
        </div>
        <div className="flex-1 flex flex-wrap gap-2">
          {Object.entries(CHECK_LABELS).filter(([k]) => stats.byKey[k]).map(([k, label]) => (
            <motion.button whileTap={{ scale: 0.96 }} key={k} type="button" onClick={() => onFilter(active === k ? "" : k)} title="Ver solo las unidades a las que les falta esto"
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors ${active === k ? "bg-brand-navy border-brand-navy text-white shadow-md shadow-brand-navy/20" : "bg-amber-500/[0.06] border-amber-500/25 text-slate-700 dark:text-slate-200 hover:border-brand-navy/40"}`}>
              Sin {label.toLowerCase()}
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${active === k ? "bg-white/20 text-white" : "bg-amber-500 text-white"}`}>{stats.byKey[k]}</span>
            </motion.button>
          ))}
          {!stats.incompletas && <span className="text-sm text-emerald-600 font-bold">Todas las fichas están completas.</span>}
        </div>
        <Button onClick={onAssign} className="rounded-xl font-bold gap-2 bg-brand-navy hover:bg-brand-navy-light text-white shrink-0"><UserCog size={16} /> Asignar encargado</Button>
      </div>
    </motion.div>
  );
};

const FleetList = () => {
  const isAdmin = getCurrentProfile() === "admin";
  useFamilies();
  const navigate = useNavigate();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [fleet, setFleet] = useState("");
  const [status, setStatus] = useState("");
  const [docsOnly, setDocsOnly] = useState(false);
  const [showAjustes, setShowAjustes] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [missing, setMissing] = useState("");
  const [mine, setMine] = useState(!isAdmin);

  const load = () =>
    fleetService
      .listar()
      .then((d) => setUnits(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const c = { total: units.length, docs: 0, ...Object.fromEntries(Object.keys(STATUS).map((k) => [k, 0])) };
    units.forEach((u) => {
      c[statusKeyOf(u)] += 1;
      if (u.docs_expired > 0 || u.docs_expiring > 0) c.docs += 1;
    });
    return c;
  }, [units]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return units.filter((u) => {
      if (mine && !u.soy_encargado) return false;
      if (missing && fichaChecklist(u).items.some((x) => x.key === missing && x.ok)) return false;
      if (fleet && u.fleet_type !== fleet) return false;
      if (status && statusKeyOf(u) !== status) return false;
      if (docsOnly && !(u.docs_expired > 0 || u.docs_expiring > 0)) return false;
      if (!term) return true;
      const p = u.profile || {};
      return [u.code, u.plate, u.driver_name, u.name, p.brand, p.model, u.brand_name, u.model_name, u.gps?.location_text].some((v) => String(v || "").toLowerCase().includes(term));
    });
  }, [units, q, fleet, status, docsOnly, mine, missing]);

  return (
    <PageLayout icon={Truck} title="Fichas de Vehículos" subtitle={`FLOTA FULLPETRO • ${units.length} UNIDADES`} accentColor="navy">
      {isAdmin ? (
        <IncompleteBlock units={units} active={missing} onFilter={setMissing} onAssign={() => setShowAssign(true)} />
      ) : (
        <div className="rounded-2xl bg-brand-navy/5 dark:bg-white/5 border border-brand-navy/10 px-4 py-3 mb-5 text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <span className="inline-flex text-brand-navy dark:text-sky-300"><ShieldCheck size={16} /></span>
          Tienes {units.filter((u) => u.soy_encargado).length} unidad(es) asignada(s). Puedes ver toda la flota, pero solo editar las tuyas.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
        <Kpi id="total" label="Unidades" value={counts.total} active={!status && !docsOnly} onClick={() => { setStatus(""); setDocsOnly(false); }} />
        {Object.entries(STATUS).map(([k, s]) => (
          <Kpi key={k} id={k} label={s.label} value={counts[k]} total={counts.total} tile={s.dot} tileText={s.on} tone={s.kpi} active={status === k} onClick={() => { setStatus(status === k ? "" : k); setDocsOnly(false); }} />
        ))}
        <Kpi id="docs" label="Documentos por vencer" value={counts.docs} total={counts.total} tile="bg-orange-500" tone="text-orange-600" active={docsOnly} onClick={() => { setDocsOnly(!docsOnly); setStatus(""); }} />
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-navy dark:text-sky-300"><Search size={16} /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por placa, código, conductor, marca o ubicación…" className={`${inputCls} pl-9 h-11 shadow-sm`} />
          {q && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-500">{shown.length} resultado(s)</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex h-11 p-1 rounded-xl bg-slate-100 dark:bg-white/5">
            {[["", "Todas"], ["LIVIANA", "Liviana"], ["PESADA", "Pesada"]].map(([v, l]) => {
              const n = v ? units.filter((u) => u.fleet_type === v).length : units.length;
              return (
                <button key={v} onClick={() => setFleet(v)} className={`relative px-3.5 rounded-lg text-sm font-extrabold transition-colors ${fleet === v ? "text-white" : "text-slate-600 dark:text-slate-300 hover:text-brand-navy"}`}>
                  {fleet === v && <motion.span layoutId="fleet-type" className="absolute inset-0 rounded-lg bg-brand-navy shadow-md shadow-brand-navy/20" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                  <span className="relative">{l} <span className="opacity-70 text-xs">{n}</span></span>
                </button>
              );
            })}
          </div>
          <button onClick={() => setMine(!mine)} className={`h-11 px-4 rounded-xl text-sm font-extrabold transition-colors ${mine ? "bg-brand-gold text-slate-900 shadow-md shadow-brand-gold/30" : "bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-navy/40"}`}>
            Mis unidades
          </button>
          <Button variant="outline" onClick={() => navigate("/fleet/catalog")} className="h-11 rounded-xl gap-2" title="Catálogo de modelos">
            <LayoutGrid size={16} /><span className="hidden lg:inline">Catálogo</span>
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowAjustes(true)} className="h-11 rounded-xl gap-2" title="Intervalos de mantenimiento">
              <Wrench size={16} /><span className="hidden lg:inline">Mantenimiento</span><Settings2 size={14} className="lg:hidden" />
            </Button>
          )}
        </div>
      </div>

      {error && <Card className="p-6 text-sm text-red-600">{error}</Card>}
      {loading ? (
        <p className="text-center text-slate-400 py-16">Cargando flota…</p>
      ) : shown.length === 0 ? (
        <p className="text-center text-slate-400 py-16">{mine ? "No tienes unidades asignadas con ese filtro." : "No hay unidades con ese filtro."}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-8">
          {shown.map((u, i) => (
            <UnitCard key={u.id} u={u} i={i} onOpen={() => navigate(`/fleet/${u.id}`)} />
          ))}
        </div>
      )}

      <AnimatePresence>{showAjustes && <AjustesModal onClose={(saved) => { setShowAjustes(false); if (saved) load(); }} />}</AnimatePresence>
      <AnimatePresence>{showAssign && <AssignManagersModal units={units} onClose={() => setShowAssign(false)} onDone={() => { setShowAssign(false); load(); }} />}</AnimatePresence>
    </PageLayout>
  );
};

export default FleetList;
