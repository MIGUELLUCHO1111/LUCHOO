import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, Search, Settings2, FileWarning, MapPin, User, Wrench, X, LayoutGrid } from "lucide-react";
import { fleetService, resolveFleetFileUrl } from "@/services";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { STATUS, statusOf, statusKeyOf, gpsState, PlateBadge, VehicleIcon, inputCls } from "./fleetParts";
import { useFamilies } from "./fleetArt";

const Kpi = ({ label, value, tone = "text-slate-900 dark:text-white", active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-left rounded-2xl border px-4 py-3 transition-all ${active ? "border-brand-navy/40 bg-brand-navy/5 dark:bg-white/5" : "border-slate-100 dark:border-white/5 bg-white/70 dark:bg-[#0f1115]/70 hover:border-slate-200 dark:hover:border-white/10"}`}
  >
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
    <p className={`font-display text-2xl mt-0.5 ${tone}`}>{value}</p>
  </button>
);

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

const UnitCard = ({ u, onOpen, i }) => {
  const st = statusOf(u);
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
      onClick={onOpen}
      className="group relative text-left rounded-3xl border border-slate-100 dark:border-white/5 bg-white/80 dark:bg-[#0f1115]/80 backdrop-blur-md p-5 overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all"
    >
      <span className={`absolute left-0 top-0 h-full w-1 ${st.bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PlateBadge plate={u.plate} size="sm" />
          <p className="mt-2 font-display text-base text-slate-900 dark:text-white truncate">{u.code}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{modelo || u.name || "Ficha técnica pendiente"}</p>
        </div>
        {u.model_photo ? (
          <img src={resolveFleetFileUrl(u.model_photo)} alt={modelo} loading="lazy" className="w-20 h-14 rounded-xl object-cover shrink-0 group-hover:scale-105 transition-transform" />
        ) : (
          <VehicleIcon fleetType={u.fleet_type} className="w-14 h-10 text-brand-navy/70 dark:text-sky-300/70 shrink-0 group-hover:scale-105 transition-transform" />
        )}
      </div>

      <div className="mt-4 space-y-1.5 text-xs">
        <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300 truncate"><User size={12} className="shrink-0 text-slate-400" />{u.driver_name || "Sin conductor"}</p>
        <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300 truncate"><MapPin size={12} className="shrink-0 text-slate-400" />{u.gps?.location_text || p.assigned_zone || "Sin ubicación"}</p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${st.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.short}
        </span>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${gps.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${gps.dot}`} />{gps.label}
        </span>
      </div>
      {docAlert && (
        <p className={`mt-3 flex items-center gap-1.5 text-[10px] font-bold ${docAlert === "vencido" ? "text-red-600" : "text-amber-600"}`}>
          <FileWarning size={12} /> Documento {docAlert}
        </p>
      )}
    </motion.button>
  );
};

const FleetList = () => {
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
      if (fleet && u.fleet_type !== fleet) return false;
      if (status && statusKeyOf(u) !== status) return false;
      if (docsOnly && !(u.docs_expired > 0 || u.docs_expiring > 0)) return false;
      if (!term) return true;
      const p = u.profile || {};
      return [u.code, u.plate, u.driver_name, u.name, p.brand, p.model, u.brand_name, u.model_name, u.gps?.location_text].some((v) => String(v || "").toLowerCase().includes(term));
    });
  }, [units, q, fleet, status, docsOnly]);

  return (
    <PageLayout icon={Truck} title="Fichas de Vehículos" subtitle={`FLOTA FULLPETRO • ${units.length} UNIDADES`} accentColor="navy">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <Kpi label="Unidades" value={counts.total} active={!status && !docsOnly} onClick={() => { setStatus(""); setDocsOnly(false); }} />
        {Object.entries(STATUS).map(([k, s]) => (
          <Kpi key={k} label={s.label} value={counts[k]} tone={s.kpi} active={status === k} onClick={() => { setStatus(status === k ? "" : k); setDocsOnly(false); }} />
        ))}
        <Kpi label="Documentos por vencer" value={counts.docs} tone="text-amber-600" active={docsOnly} onClick={() => { setDocsOnly(!docsOnly); setStatus(""); }} />
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por placa, código, conductor, marca o ubicación…" className={`${inputCls} pl-9 h-11`} />
        </div>
        <div className="flex gap-2">
          {[["", "Todas"], ["LIVIANA", "Liviana"], ["PESADA", "Pesada"]].map(([v, l]) => (
            <button key={v} onClick={() => setFleet(v)} className={`h-11 px-4 rounded-xl text-sm font-bold transition-colors ${fleet === v ? "bg-brand-navy text-white" : "bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
              {l}
            </button>
          ))}
          <Button variant="outline" onClick={() => navigate("/fleet/catalog")} className="h-11 rounded-xl gap-2" title="Catálogo de modelos">
            <LayoutGrid size={16} /><span className="hidden lg:inline">Catálogo</span>
          </Button>
          <Button variant="outline" onClick={() => setShowAjustes(true)} className="h-11 rounded-xl gap-2" title="Intervalos de mantenimiento">
            <Wrench size={16} /><span className="hidden lg:inline">Mantenimiento</span><Settings2 size={14} className="lg:hidden" />
          </Button>
        </div>
      </div>

      {error && <Card className="p-6 text-sm text-red-600">{error}</Card>}
      {loading ? (
        <p className="text-center text-slate-400 py-16">Cargando flota…</p>
      ) : shown.length === 0 ? (
        <p className="text-center text-slate-400 py-16">No hay unidades con ese filtro.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-8">
          {shown.map((u, i) => (
            <UnitCard key={u.id} u={u} i={i} onOpen={() => navigate(`/fleet/${u.id}`)} />
          ))}
        </div>
      )}

      <AnimatePresence>{showAjustes && <AjustesModal onClose={(saved) => { setShowAjustes(false); if (saved) load(); }} />}</AnimatePresence>
    </PageLayout>
  );
};

export default FleetList;
