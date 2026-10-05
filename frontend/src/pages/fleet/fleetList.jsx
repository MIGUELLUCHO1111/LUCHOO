import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ArrowLeft, ArrowRight, AlertTriangle, Truck, Search, FileWarning, MapPin, User, Wrench, X, LayoutGrid, UserCog, ClipboardList, ShieldCheck, Briefcase, CircleCheck, Ban, ChevronRight } from "lucide-react";
import { fleetService, resolveFleetFileUrl } from "@/services";
import { getCurrentProfile } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { STATUS, statusOf, statusKeyOf, gpsState, PlateBadge, VehicleIcon, inputCls } from "./fleetParts";
import { useFamilies } from "./fleetArt";
import { fichaChecklist, CHECK_LABELS, docsState, docsDetalle } from "./fleetCompleteness";
import AssignManagersModal from "./fleetManagers";
import NewUnitModal from "./fleetNewUnit";
import DocsBadge from "./fleetDocsBadge";

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

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.015, 0.3) }}
      whileHover={{ y: -4 }}
      onClick={onOpen}
      className="group relative text-left rounded-3xl border border-slate-100 dark:border-white/5 bg-white/90 dark:bg-[#0f1115]/80 backdrop-blur-md p-5 hover:z-20 hover:shadow-xl hover:shadow-brand-navy/10 transition-shadow"
    >
      <span className={`absolute left-0 top-0 h-full w-1.5 rounded-l-3xl ${st.bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PlateBadge plate={u.plate} size="sm" />
          <p className="mt-2 font-display text-lg text-brand-navy dark:text-white truncate">{u.code}</p>
          <p className={`text-xs truncate ${modelo || u.name ? "text-slate-600 dark:text-slate-300 font-semibold" : "text-amber-600 font-bold"}`}>{modelo || u.name || "Ficha técnica pendiente"}</p>
        </div>
        {p.photo_url || u.model_photo ? (
          <img src={resolveFleetFileUrl(p.photo_url || u.model_photo)} alt={modelo || u.code} loading="lazy" className="w-24 h-16 rounded-xl object-cover shrink-0 shadow-sm group-hover:scale-105 transition-transform" />
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
      <span className="mt-3 block"><DocsBadge unit={u} /></span>
    </motion.button>
  );
};

// ---------- Accesos a cada flota (pedido de Lguerra, 05/10/2026) ----------
// Dos tarjetas grandes en "Todas"; al tocar una se abre la vista de esa flota
// (/fleet?flota=liviana|pesada, tambien en el menu lateral).
const FLEETS = {
  // Colores (pedido de Lguerra, 05/10/2026): Liviana azul marino, Pesada amarillo Caterpillar.
  liviana: { type: "LIVIANA", title: "Flota Liviana", desc: "Camionetas, pickups y vehículos de pasajeros", grad: "from-[#1f4a6e] via-brand-navy to-[#0b2236]", glow: "shadow-brand-navy/30", text: "text-white", sub: "text-sky-100/80", contrato: "bg-emerald-600 text-white", disp: "bg-orange-500 text-white", soft: "bg-white/15", dark: "bg-black/25" },
  pesada: { type: "PESADA", title: "Flota Pesada", desc: "Grúas, montacargas, camiones y equipos del contrato", grad: "from-[#FFD84D] via-[#FFCD11] to-[#E6B400]", glow: "shadow-amber-400/40", text: "text-slate-900", sub: "text-slate-900/70", contrato: "bg-emerald-600 text-white", disp: "bg-orange-500 text-white", soft: "bg-black/10", dark: "bg-black/15" },
};
const fleetStats = (list) => ({
  total: list.length,
  contrato: list.filter((u) => statusKeyOf(u) === "OPERATIVO_CONTRATO").length,
  disponibles: list.filter((u) => statusKeyOf(u) === "DISPONIBLE").length,
  fuera: list.filter((u) => statusKeyOf(u) === "FUERA_DE_SERVICIO").length,
  docs: list.filter((u) => docsState(u).key === "vencido").length,
  incompletas: list.filter((u) => !fichaChecklist(u).complete).length,
});

// Una etiqueta de resumen que lleva a esa flota ya filtrada (pedido de
// Lguerra, 05/10/2026). Es <span role=button> porque va dentro del boton de
// la tarjeta.
const Chip = ({ cls, onGo, title, children }) => (
  <motion.span
    role="button"
    tabIndex={0}
    title={title}
    whileHover={{ y: -2, scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={(e) => { e.stopPropagation(); onGo(); }}
    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onGo(); } }}
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 cursor-pointer shadow-sm hover:shadow-md ring-0 hover:ring-2 hover:ring-white/70 transition-shadow ${cls}`}
  >
    {children} <span className="opacity-70">›</span>
  </motion.span>
);

const FleetPortal = ({ units, onOpen }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
    {Object.entries(FLEETS).map(([key, f], i) => {
      const list = units.filter((u) => u.fleet_type === f.type);
      const s = fleetStats(list);
      return (
        <motion.button
          key={key}
          type="button"
          onClick={() => onOpen(key)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.99 }}
          className={`group relative overflow-hidden text-left rounded-3xl bg-gradient-to-br ${f.grad} ${f.text} p-6 shadow-xl ${f.glow}`}
        >
          <span className="absolute -right-6 -bottom-8 opacity-20 group-hover:opacity-30 group-hover:-translate-x-2 transition-all duration-500">
            <VehicleIcon fleetType={f.type} className={`w-64 h-40 ${f.text}`} />
          </span>
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className={`text-[11px] font-extrabold uppercase tracking-[0.18em] ${f.sub}`}>{f.desc}</p>
              <p className="font-display text-3xl mt-1">{f.title}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-5xl leading-none">{s.total}</p>
              <p className={`text-xs font-bold ${f.sub}`}>unidades</p>
            </div>
          </div>
          <div className="relative mt-5 flex flex-wrap gap-2 text-[11px] font-bold">
            <Chip cls={f.contrato} title="Ver las unidades en contrato" onGo={() => onOpen(key, { estado: "OPERATIVO_CONTRATO" })}>{s.contrato} en contrato</Chip>
            <Chip cls={f.disp} title="Ver las unidades disponibles" onGo={() => onOpen(key, { estado: "DISPONIBLE" })}>{s.disponibles} disponibles</Chip>
            {s.fuera > 0 && <Chip cls="bg-red-600 text-white" title="Ver las unidades fuera de servicio" onGo={() => onOpen(key, { estado: "FUERA_DE_SERVICIO" })}>{s.fuera} fuera de servicio</Chip>}
            {s.docs > 0 && <Chip cls="bg-red-600 text-white" title="Ver las unidades con documentos vencidos (la más vencida primero)" onGo={() => onOpen(key, { ver: "doc_vencido" })}>{s.docs} con papel vencido</Chip>}
            <Chip cls={f.dark} title="Ver las fichas incompletas (las que menos datos tienen primero)" onGo={() => onOpen(key, { ver: "incompleta" })}>{s.incompletas} ficha(s) incompleta(s)</Chip>
          </div>
          <span className="relative mt-5 inline-flex items-center gap-2 rounded-xl bg-white text-slate-900 px-4 py-2 text-sm font-extrabold shadow-md group-hover:gap-3 transition-all">
            Ver {f.title.toLowerCase()} <span className="inline-flex"><ArrowRight size={16} /></span>
          </span>
        </motion.button>
      );
    })}
  </div>
);

const FleetList = () => {
  const isAdmin = getCurrentProfile() === "admin";
  useFamilies();
  const navigate = useNavigate();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [params, setParams] = useSearchParams();
  const flotaKey = (params.get("flota") || "").toLowerCase();
  const fleet = FLEETS[flotaKey]?.type || (flotaKey === "sin-clasificar" ? "NONE" : "");
  const setFleet = (v) => {
    const key = Object.keys(FLEETS).find((k) => FLEETS[k].type === v) || (v === "NONE" ? "sin-clasificar" : "");
    setParams(key ? { flota: key } : {});
  };
  // Filtros que vienen de las etiquetas de las tarjetas (o del selector "Ver todas").
  const estado = params.get("estado") || "";
  const missing = params.get("ver") || "";
  const setFiltro = (name, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value); else next.delete(name);
    setParams(next);
  };
  const setMissing = (v) => setFiltro("ver", v);
  const [showAjustes, setShowAjustes] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [mine, setMine] = useState(!isAdmin);

  const load = () =>
    fleetService
      .listar()
      .then((d) => {
        const list = Array.isArray(d) ? d : [];
        setUnits(list);
        // "Mis unidades" arranca activo solo si el usuario es encargado de
        // alguna; sin ninguna asignada la lista saldría vacía y parecería que
        // no puede ver la flota (sí puede, en solo lectura).
        if (!list.some((u) => u.soy_encargado)) setMine(false);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  // Unidades de la flota elegida (todo lo de la pagina se calcula sobre ellas).
  const scoped = useMemo(() => (fleet === "NONE" ? units.filter((u) => !u.fleet_type) : fleet ? units.filter((u) => u.fleet_type === fleet) : units), [units, fleet]);
  const sinClasificar = units.filter((u) => !u.fleet_type).length;

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return scoped.filter((u) => {
      if (mine && !u.soy_encargado) return false;
      if (estado && statusKeyOf(u) !== estado) return false;
      if (missing.startsWith("doc_")) { if (docsState(u).key !== missing.slice(4)) return false; }
      else if (missing === "incompleta") { if (fichaChecklist(u).complete) return false; }
      else if (missing && fichaChecklist(u).items.some((x) => x.key === missing && x.ok)) return false;
      if (!term) return true;
      const p = u.profile || {};
      return [u.code, u.plate, u.driver_name, u.name, p.brand, p.model, u.brand_name, u.model_name, u.gps?.location_text].some((v) => String(v || "").toLowerCase().includes(term));
    });
  }, [scoped, q, mine, missing, estado]);

  // Orden segun lo que se esta mirando: lo mas urgente primero.
  const ordered = useMemo(() => {
    const minDias = (u, st) => Math.min(...docsDetalle(u).filter((x) => x.state === st).map((x) => x.days_left ?? Infinity), Infinity);
    const list = shown.slice();
    if (missing === "doc_vencido") list.sort((a, b) => minDias(a, "vencido") - minDias(b, "vencido"));
    else if (missing === "doc_por_vencer") list.sort((a, b) => minDias(a, "por_vencer") - minDias(b, "por_vencer"));
    else if (missing && !missing.startsWith("doc_")) list.sort((a, b) => fichaChecklist(a).pct - fichaChecklist(b).pct || String(a.code).localeCompare(String(b.code)));
    return list;
  }, [shown, missing]);
  const ORDEN = { doc_vencido: "la más vencida primero", doc_por_vencer: "la que vence antes primero", incompleta: "las que menos datos tienen primero" };
  const filtroActivo = [
    estado && STATUS[estado]?.label,
    missing && (missing === "incompleta" ? "Fichas incompletas" : missing.startsWith("doc_") ? { doc_vencido: "Con documentos vencidos", doc_por_vencer: "Con documentos por vencer", doc_faltan: "Con documentos por cargar", doc_al_dia: "Con documentos al día" }[missing] : `Sin ${(CHECK_LABELS[missing] || missing).toLowerCase()}`),
  ].filter(Boolean).join(" · ");

  // Opciones del filtro "Ver solo…" con su cantidad (en la flota que se esta viendo).
  const filtros = useMemo(() => {
    const falta = {};
    const docs = { vencido: 0, por_vencer: 0, faltan: 0, al_dia: 0 };
    scoped.forEach((u) => {
      fichaChecklist(u).items.filter((x) => !x.ok).forEach((x) => { falta[x.key] = (falta[x.key] || 0) + 1; });
      docs[docsState(u).key] += 1;
    });
    return { falta, docs };
  }, [scoped]);

  return (
    <PageLayout
      icon={Truck}
      title={FLEETS[flotaKey]?.title || (fleet === "NONE" ? "Unidades sin clasificar" : "Fichas de Vehículos")}
      subtitle={`FLOTA FULLPETRO • ${scoped.length} UNIDADES`}
      accentColor="navy"
    >
      {fleet ? (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <motion.button whileHover={{ x: -3 }} type="button" onClick={() => setFleet("")} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy text-white px-4 h-10 text-sm font-extrabold shadow-md shadow-brand-navy/20">
            <ArrowLeft size={16} /> Toda la flota
          </motion.button>
          {fleet !== "NONE" && (
            <div className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r ${FLEETS[flotaKey].grad} ${FLEETS[flotaKey].text} px-4 h-10 text-sm font-extrabold shadow-md`}>
              <VehicleIcon fleetType={fleet} className={`w-8 h-5 ${FLEETS[flotaKey].text}`} /> {FLEETS[flotaKey].title} · {scoped.length} unidades
            </div>
          )}
          {fleet === "NONE" && <p className="text-sm text-slate-600 dark:text-slate-300">Estas unidades no tienen tipo de flota: ábrelas y elige <b>Liviana</b> o <b>Pesada</b> en "Editar ficha".</p>}
        </div>
      ) : (
        <>
          <FleetPortal units={units} onOpen={(key, extra = {}) => setParams({ flota: key, ...extra })} />
          {sinClasificar > 0 && (
            <button type="button" onClick={() => setFleet("NONE")} className="mb-5 w-full flex items-center gap-2 rounded-2xl border border-dashed border-amber-400/60 bg-amber-500/[0.06] px-4 py-2.5 text-left text-sm font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-500/10">
              <AlertTriangle size={16} /> {sinClasificar} unidad(es) sin tipo de flota (ni Liviana ni Pesada) · Ver y clasificar <ArrowRight size={14} className="ml-auto" />
            </button>
          )}
        </>
      )}
      {!isAdmin && (
        <div className="rounded-2xl bg-brand-navy/5 dark:bg-white/5 border border-brand-navy/10 px-4 py-3 mb-5 text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <span className="inline-flex text-brand-navy dark:text-sky-300"><ShieldCheck size={16} /></span>
          Tienes {units.filter((u) => u.soy_encargado).length} unidad(es) asignada(s). Puedes ver toda la flota, pero solo editar las tuyas.
        </div>
      )}
      {/* Barra (pedido de Lguerra, 05/10/2026): "Nueva unidad" predominante junto
          al buscador, y la fila de botones repartida a todo el ancho. */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy dark:text-sky-300"><Search size={18} /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por placa, código, conductor, marca o ubicación…" className={`${inputCls} pl-11 h-12 text-base shadow-sm`} />
            {q && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-500">{shown.length} resultado(s)</span>}
          </div>
          {isAdmin && (
            <motion.button
              type="button"
              onClick={() => setShowNew(true)}
              title="Registrar una unidad nueva (único lugar donde se crean a mano)"
              whileHover={{ y: -3, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="group relative overflow-hidden h-12 px-7 rounded-2xl inline-flex items-center justify-center gap-3 text-base font-black text-slate-900 bg-gradient-to-r from-[#FFD84D] via-[#FFCD11] to-[#E6B400] shadow-lg shadow-amber-400/40 hover:shadow-xl hover:shadow-amber-400/50 ring-2 ring-[#FFCD11]/40 shrink-0"
            >
              {/* brillo que recorre el boton */}
              <motion.span
                aria-hidden
                className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-[-20deg] pointer-events-none"
                animate={{ x: ["0%", "450%"] }}
                transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}
              />
              <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-navy text-white shadow-md transition-transform duration-300 group-hover:rotate-90">
                <Plus size={18} strokeWidth={3} />
              </span>
              <span className="relative leading-tight text-left">
                Nueva unidad
                <span className="block text-[10px] font-bold text-slate-800/70 tracking-wide">Registrar en la flota</span>
              </span>
            </motion.button>
          )}
        </div>

        <div className={`grid grid-cols-2 md:grid-cols-3 gap-2 ${isAdmin ? "xl:grid-cols-[2fr_1fr_2fr_1.4fr_1fr_1.25fr]" : "xl:grid-cols-[2fr_1fr_2fr_1fr]"}`}>
          <div className="col-span-2 md:col-span-1 flex h-11 p-1 rounded-xl bg-slate-100 dark:bg-white/5">
            {[["", "Todas"], ["LIVIANA", "Liviana"], ["PESADA", "Pesada"]].map(([v, l]) => {
              const n = v ? units.filter((u) => u.fleet_type === v).length : units.length;
              return (
                <button key={v} onClick={() => setFleet(v)} className={`relative flex-1 px-2 rounded-lg text-sm font-extrabold whitespace-nowrap transition-colors ${fleet === v ? "text-white" : "text-slate-600 dark:text-slate-300 hover:text-brand-navy"}`}>
                  {fleet === v && <motion.span layoutId="fleet-type" className="absolute inset-0 rounded-lg bg-brand-navy shadow-md shadow-brand-navy/20" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                  <span className="relative">{l} <span className="opacity-70 text-xs">{n}</span></span>
                </button>
              );
            })}
          </div>
          <button onClick={() => setMine(!mine)} className={`w-full h-11 px-4 rounded-xl text-sm font-extrabold whitespace-nowrap transition-colors ${mine ? "bg-brand-gold text-slate-900 shadow-md shadow-brand-gold/30" : "bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-navy/40"}`}>
            Mis unidades
          </button>
          <select value={missing} onChange={(e) => setMissing(e.target.value)} title="Ver solo las unidades que…"
            className={`w-full col-span-2 md:col-span-1 h-11 rounded-xl border px-3 text-sm font-bold shadow-sm ${missing ? "bg-brand-navy text-white border-brand-navy" : "bg-white dark:bg-[#0f1115] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
            <option value="">Ver todas</option>
            <optgroup label="Documentos">
              <option value="doc_vencido">Con documentos vencidos ({filtros.docs.vencido})</option>
              <option value="doc_por_vencer">Con documentos por vencer ({filtros.docs.por_vencer})</option>
              <option value="doc_faltan">Con documentos por cargar ({filtros.docs.faltan})</option>
              <option value="doc_al_dia">Con documentos al día ({filtros.docs.al_dia})</option>
            </optgroup>
            <option value="incompleta">Fichas incompletas ({scoped.filter((u) => !fichaChecklist(u).complete).length})</option>
            <optgroup label="Ficha incompleta: le falta">
              {Object.entries(CHECK_LABELS).filter(([k]) => filtros.falta[k]).map(([k, label]) => <option key={k} value={k}>{label} ({filtros.falta[k]})</option>)}
            </optgroup>
          </select>
          {isAdmin && (
            <Button onClick={() => setShowAssign(true)} className="w-full h-11 rounded-xl gap-2 font-bold whitespace-nowrap bg-brand-navy hover:bg-brand-navy-light text-white" title="Asignar encargado a varias unidades">
              <UserCog size={16} /> Asignar encargado
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate("/fleet/catalog")} className="w-full h-11 rounded-xl gap-2 font-bold whitespace-nowrap" title="Catálogo de modelos">
            <LayoutGrid size={16} /> Catálogo
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowAjustes(true)} className="w-full h-11 rounded-xl gap-2 font-bold whitespace-nowrap" title="Intervalos de mantenimiento">
              <Wrench size={16} /> Mantenimiento
            </Button>
          )}
        </div>
      </div>

      {filtroActivo && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-navy text-white px-4 py-3 shadow-md shadow-brand-navy/20">
          <span className="text-sm font-extrabold">Mostrando: {filtroActivo}</span>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-black">{ordered.length} unidad(es)</span>
          {ORDEN[missing] && <span className="text-xs text-sky-100/80">Ordenadas: {ORDEN[missing]}</span>}
          <button type="button" onClick={() => { const next = new URLSearchParams(params); next.delete("estado"); next.delete("ver"); setParams(next); }} className="ml-auto inline-flex items-center gap-1 rounded-xl bg-white text-brand-navy px-3 py-1.5 text-xs font-extrabold hover:bg-sky-50">
            <span className="inline-flex"><X size={13} /></span> Quitar filtro
          </button>
        </motion.div>
      )}
      {error && <Card className="p-6 text-sm text-red-600">{error}</Card>}
      {loading ? (
        <p className="text-center text-slate-400 py-16">Cargando flota…</p>
      ) : shown.length === 0 ? (
        <p className="text-center text-slate-400 py-16">{mine ? "No tienes unidades asignadas con ese filtro." : "No hay unidades con ese filtro."}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-8">
          {ordered.map((u, i) => (
            <UnitCard key={u.id} u={u} i={i} onOpen={() => navigate(`/fleet/${u.id}`)} />
          ))}
        </div>
      )}

      <AnimatePresence>{showAjustes && <AjustesModal onClose={(saved) => { setShowAjustes(false); if (saved) load(); }} />}</AnimatePresence>
      <AnimatePresence>{showNew && <NewUnitModal defaultFleet={fleet === "LIVIANA" || fleet === "PESADA" ? fleet : ""} onClose={() => setShowNew(false)} />}</AnimatePresence>
      <AnimatePresence>{showAssign && <AssignManagersModal units={units} onClose={() => setShowAssign(false)} onDone={() => { setShowAssign(false); load(); }} />}</AnimatePresence>
    </PageLayout>
  );
};

export default FleetList;
