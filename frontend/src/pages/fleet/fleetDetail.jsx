import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, ArrowLeft, Pencil, Gauge, User, MapPin, Phone, FileText, Wrench, StickyNote, Activity,
  Radio, Plus, X, Fingerprint, UserCog, CheckCircle2, Circle, Lock, Fuel, Cpu, Repeat, History,
  Factory, Car, Layers, Weight, CalendarDays, Palette, Cog, Hash, ScanBarcode, Container, Check, Receipt, Send, Camera,
} from "lucide-react";
import { useConfirm } from "@/context";
import { fleetService, resolveFleetFileUrl } from "@/services";
import { getCurrentProfile } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import {
  STATUS, statusOf, statusKeyOf, gpsState, PlateBadge, VehicleIcon, FLEET_LABEL, Field, inputCls,
  fmtKm, fmtMoney, fmtDate, fmtDateTime, initials, haceCuanto, maintProgress, TONE, isFullSheet,
} from "./fleetParts";
import { categoryLabel, useFamilies } from "./fleetArt";
import DocumentsPanel from "./fleetDocuments";
import { fichaChecklist } from "./fleetCompleteness";
import DocsBadge from "./fleetDocsBadge";
import { DriverTile, FrenteTile, ParadaTile, paradaInfo } from "./fleetAssign";
import AssignManagersModal from "./fleetManagers";
import ReadingsPanel, { SOURCE as READING_SOURCE } from "./fleetReadings";
import FichaPdfButton from "./fleetSheetDownload";

const EVENT_ICON = {
  CONDUCTOR: User, ESTADO: Activity, UBICACION: MapPin, ODOMETRO: Gauge, MANTENIMIENTO: Wrench,
  DOCUMENTO: FileText, NOTA: StickyNote, EDICION: Pencil, GPS: Radio, CREADO: Plus,
};
const EVENT_TONE = {
  CONDUCTOR: "bg-sky-600 text-white", ESTADO: "bg-amber-500 text-white", UBICACION: "bg-teal-600 text-white",
  ODOMETRO: "bg-indigo-600 text-white", MANTENIMIENTO: "bg-orange-500 text-white", DOCUMENTO: "bg-violet-600 text-white",
  NOTA: "bg-brand-gold text-white", EDICION: "bg-slate-500 text-white", GPS: "bg-emerald-600 text-white", CREADO: "bg-brand-navy text-white",
};

const SectionTitle = ({ icon: Icon, children, right }) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="flex items-center gap-2.5 text-[13px] font-extrabold uppercase tracking-[0.12em] text-brand-navy dark:text-sky-200">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-navy text-white shadow-md shadow-brand-navy/20 dark:bg-sky-700"><Icon size={14} /></span>
      {children}
    </h3>
    {right}
  </div>
);

const Panel = ({ children, className = "" }) => (
  <Card className={`p-6 rounded-3xl shadow-sm ${className}`}>{children}</Card>
);

// ---------- ADN del vehiculo: un cajetin por dato ----------
// Pedido de Lguerra (05/10/2026): que se note cada dato. Los vacios dicen
// "Por completar" y, si se puede editar, abren el formulario al hacer clic.
const COLOR_HEX = {
  BLANCO: "#f8fafc", NEGRO: "#0f172a", GRIS: "#94a3b8", PLATA: "#cbd5e1", PLATEADO: "#cbd5e1", ROJO: "#dc2626",
  AZUL: "#2563eb", VERDE: "#16a34a", AMARILLO: "#facc15", NARANJA: "#f97316", MARRON: "#92400e", BEIGE: "#e7d7b1",
  VINOTINTO: "#7f1d1d", DORADO: "#d99b0a", BRONCE: "#a16207",
};
const colorHex = (c) => COLOR_HEX[String(c || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().split(/\s+/)[0]];
const isEmpty = (v) => v == null || v === "" || v === "—";

const AdnTile = ({ icon: Icon, label, value, hint, swatch, onEdit, mono = false }) => {
  const empty = isEmpty(value);
  const click = empty && onEdit;
  const Tag = click ? motion.button : motion.div;
  return (
    <Tag
      type={click ? "button" : undefined}
      onClick={click ? onEdit : undefined}
      whileHover={{ y: -2 }}
      title={click ? `Agregar ${label.toLowerCase()}` : undefined}
      className={`group flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${empty ? "border-dashed border-slate-300 dark:border-white/15 hover:border-brand-navy/50 hover:bg-brand-navy/[0.03]" : "border-slate-100 dark:border-white/5 bg-white/80 dark:bg-white/[0.02] hover:shadow-md hover:shadow-brand-navy/5"}`}
    >
      <span className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${empty ? "bg-slate-100 text-slate-400 dark:bg-white/5 group-hover:bg-brand-navy group-hover:text-white" : "bg-brand-navy text-white shadow-md shadow-brand-navy/20 dark:bg-sky-700"}`}>
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        {empty ? (
          <span className="block text-xs font-bold text-amber-600 dark:text-amber-400 truncate">Por completar</span>
        ) : (
          <span className={`flex items-center gap-1.5 text-sm font-extrabold text-brand-navy dark:text-white ${mono ? "font-mono" : ""}`} title={String(value)}>
            {swatch && <span className="h-3.5 w-3.5 rounded-full border border-slate-300 dark:border-white/20 shrink-0" style={{ background: swatch }} />}
            <span className="truncate">{value}</span>
          </span>
        )}
        {hint && !empty && <span className="block text-[10px] text-slate-400 truncate">{hint}</span>}
      </span>
      {click && <span className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0 text-slate-300 group-hover:bg-brand-navy group-hover:text-white transition-colors"><Plus size={13} /></span>}
    </Tag>
  );
};

const BatteryBar = ({ value }) => {
  const b = Math.max(0, Math.min(100, Number(value)));
  const tone = b <= 15 ? "bg-red-500" : b <= 40 ? "bg-amber-500" : "bg-emerald-500";
  const txt = b <= 15 ? "text-red-600" : b <= 40 ? "text-amber-600" : "text-emerald-600";
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Batería del equipo</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="h-2 flex-1 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
          <motion.span initial={{ width: 0 }} animate={{ width: `${Math.max(b, 3)}%` }} transition={{ duration: 0.8 }} className={`block h-full rounded-full ${tone}`} />
        </span>
        <span className={`text-sm font-extrabold ${txt}`}>{b}%</span>
      </div>
      {b <= 15 && <p className="text-[10px] font-bold text-red-600 mt-0.5">Batería agotada: revisar alimentación</p>}
    </div>
  );
};

// ---------- Foto propia de la unidad (053_fleet_unit_photo.sql) ----------
// Pedido de Lguerra (05/10/2026): cada ficha con su foto, cargada desde aqui
// (clic o arrastrar). Si no tiene foto propia se muestra la del modelo del
// catalogo con la marca "Foto del modelo".
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const UnitPhoto = ({ unit, onChanged }) => {
  const confirm = useConfirm();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [drag, setDrag] = useState(false);
  const own = unit.profile?.photo_url;
  const src = own || unit.model_photo;
  const can = !!unit.puede_editar;

  const pick = async (file) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return setError("Solo fotos JPG, PNG o WEBP.");
    if (file.size > 8 * 1024 * 1024) return setError("La foto pesa más de 8 MB.");
    setBusy(true);
    setError(null);
    try {
      await fleetService.subirFotoUnidad(unit.id, file);
      await onChanged();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  const quitar = async () => {
    if (!(await confirm("¿Quitar la foto de esta unidad?", { title: "Quitar foto", confirmText: "Quitar foto" }))) return;
    setBusy(true);
    try {
      await fleetService.quitarFotoUnidad(unit.id);
      await onChanged();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shrink-0 flex flex-col items-center gap-1.5">
      <motion.div
        whileHover={{ scale: 1.02 }}
        onClick={() => (can ? ref.current?.click() : src && window.open(resolveFleetFileUrl(src), "_blank"))}
        onDragOver={(e) => { if (can) { e.preventDefault(); setDrag(true); } }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { if (can) { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); } }}
        title={can ? (own ? "Cambiar la foto del vehículo" : "Cargar la foto del vehículo") : src ? "Ver la foto" : ""}
        className={`group relative w-full sm:w-[24rem] aspect-[16/10] rounded-3xl overflow-hidden flex items-center justify-center shadow-lg transition-colors ${can || src ? "cursor-pointer" : ""} ${src ? "bg-slate-900/5" : can ? "border-2 border-dashed border-brand-navy/30 bg-brand-navy/[0.03] hover:border-brand-navy hover:bg-brand-navy/5" : "bg-slate-50 dark:bg-white/5"} ${drag ? "ring-4 ring-brand-gold" : ""}`}
      >
        {src ? (
          <motion.img key={src} initial={{ scale: 1.08, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} src={resolveFleetFileUrl(src)} alt={`Foto de ${unit.code}`} className="w-full h-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-center px-3">
            <VehicleIcon fleetType={unit.fleet_type} className="w-36 h-24 text-brand-navy/50 dark:text-sky-300/50" />
            {can && <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-navy text-white px-3.5 py-2 text-xs font-extrabold shadow-md shadow-brand-navy/20"><Camera size={14} /> Cargar foto del vehículo</span>}
            {can && <span className="text-[11px] text-slate-500">o arrastra la imagen aquí · JPG, PNG o WEBP hasta 8 MB</span>}
          </span>
        )}
        {src && !own && <span className="absolute left-2.5 top-2.5 rounded-lg bg-black/55 text-white text-[10px] font-bold px-2 py-0.5">Foto del modelo</span>}
        {src && can && (
          <button type="button" onClick={(e) => { e.stopPropagation(); window.open(resolveFleetFileUrl(src), "_blank"); }} title="Ver en tamaño completo"
            className="absolute right-2.5 top-2.5 z-10 rounded-lg bg-black/55 hover:bg-black/75 text-white text-[10px] font-bold px-2 py-1">Ver en grande</button>
        )}
        {can && src && (
          <span className="absolute inset-0 bg-brand-navy/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white text-xs font-extrabold">
            <Camera size={26} /> {own ? "Cambiar foto" : "Cargar foto propia"}
            <span className="text-[10px] font-semibold text-sky-100/80">clic o arrastra aquí</span>
          </span>
        )}
        {busy && <span className="absolute inset-0 bg-white/80 dark:bg-black/60 flex items-center justify-center text-xs font-extrabold text-brand-navy dark:text-white">Guardando…</span>}
      </motion.div>
      {can && own && !busy && <button type="button" onClick={quitar} className="text-[10px] font-bold text-slate-400 hover:text-red-600">Quitar foto</button>}
      {error && <p className="text-[10px] font-bold text-red-600 max-w-[12rem] text-center">{error}</p>}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
};

// ---------- Km por dia (API v3 del GPS) ----------
const KmSparkline = ({ dias }) => {
  if (!dias?.length) return null;
  const last = dias.slice(-30);
  const max = Math.max(...last.map((d) => d.km), 1);
  const total = last.reduce((s, d) => s + d.km, 0);
  const conMov = last.filter((d) => d.km > 0).length;
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-white/5 p-3">
      <div className="flex items-end justify-between mb-2 gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Km por día · últimos {last.length} días</p>
          <p className="text-[11px] text-slate-500">{conMov} día(s) con movimiento · promedio {fmtKm(conMov ? total / conMov : 0)}/día</p>
        </div>
        <p className="font-display text-lg text-brand-navy dark:text-white leading-none">{fmtKm(total)}</p>
      </div>
      <div className="flex items-end gap-[3px] h-14">
        {last.map((d, i) => (
          <motion.div
            key={d.fecha}
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(4, (d.km / max) * 100)}%` }}
            transition={{ delay: i * 0.015, duration: 0.4 }}
            title={`${fmtDate(d.fecha)}: ${fmtKm(d.km)}`}
            className={`flex-1 rounded-t cursor-default transition-colors ${d.km === max ? "bg-brand-gold" : "bg-gradient-to-t from-brand-navy to-sky-500 hover:from-brand-gold hover:to-brand-gold"}`}
            style={{ opacity: d.km ? 1 : 0.2 }}
          />
        ))}
      </div>
    </div>
  );
};

// ---------- Panel lateral para editar la ficha ----------
const EDIT_SECTIONS = [
  {
    title: "Identificación y asignación",
    fields: [
      ["name", "Nombre / descripción"], ["short_code", "Código corto de la política (ej. GT-02)"], ["fleet_type", "Tipo de flota", "fleet"], ["driver_name", "Conductor"],
      ["driver_phone", "Teléfono del conductor"], ["driver_assigned_at", "Asignado desde", "date"], ["next_driver", "Próximo conductor"],
      ["assigned_zone", "Zona / centro de costos"], ["fleet_manager", "Gerente de la flotilla"],
    ],
  },
  {
    title: "ADN del vehículo",
    fields: [
      ["__model", "Modelo del catálogo", "catalog"], ["model_year", "Año", "number"], ["color", "Color"],
      ["engine_type", "Tipo de motor", "engine"], ["vin", "Serial de carrocería (chasis)"], ["engine_serial", "Serial de motor"], ["fuel_type", "Combustible", "fuel"], ["tank_capacity_liters", "Capacidad del tanque (L)", "number"],
    ],
  },
  {
    title: "Operación y mantenimiento",
    fields: [
      ["last_maint_km", "Último mantenimiento (km)", "number"], ["last_maint_at", "Fecha último mantenimiento", "date"],
      ["maint_interval_km", "Intervalo propio (km, vacío = el de su flota)", "number"], ["avg_consumption_kml", "Consumo promedio (km/L)", "number"],
      ["change_plan", "Plan para cambiar de vehículo", "bool"],
    ],
  },
  {
    title: "Fiscal y contrato",
    fields: [
      ["order_date", "Fecha de la orden", "date"], ["registration_date", "Fecha de ingreso / registro", "date"],
      ["first_contract_date", "Fecha del primer contrato", "date"], ["cancellation_date", "Fecha de cancelación", "date"],
      ["hp_tax", "Impuestos sobre caballos de fuerza", "number"], ["catalog_value", "Valor de catálogo (IVA incl.)", "number"],
      ["purchase_value", "Valor de compra", "number"], ["residual_value", "Valor residual", "number"], ["tags", "Etiquetas"],
    ],
  },
];
const UNIT_KEYS = ["name", "fleet_type", "driver_name", "tank_capacity_liters"];
// Sugerencias para "Tipo de motor" (se puede escribir cualquier otro).
const ENGINE_TYPES = ["3 cilindros", "4 cilindros", "4 cilindros turbo", "6 cilindros en línea", "V6", "V8", "Turbo diésel", "Diésel common rail", "Híbrido", "Eléctrico"];

const valueOf = (unit, key) => {
  const v = UNIT_KEYS.includes(key) ? unit[key] : unit.profile?.[key];
  if (v == null) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  return v;
};

const EditDrawer = ({ unit, full, onClose, onSaved }) => {
  // La ficha basica (flota liviana y equipos fuera del contrato) no lleva datos fiscales.
  const sections = (full ? EDIT_SECTIONS : EDIT_SECTIONS.filter((s) => s.title !== "Fiscal y contrato")).map((s) =>
    unit.es_admin ? s : { ...s, fields: s.fields.filter(([k]) => k !== "fleet_type") },
  );
  const initial = useMemo(() => {
    const o = {};
    sections.forEach((s) => s.fields.forEach(([k, , t]) => { if (t !== "catalog") o[k] = t === "bool" ? !!unit.profile?.[k] : valueOf(unit, k); }));
    return o;
  }, [unit]);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const initialModel = String(unit.profile?.model_id || "");
  const initialVersion = String(unit.profile?.version_id || "");
  const [modelId, setModelId] = useState(initialModel);
  const [versionId, setVersionId] = useState(initialVersion);
  useEffect(() => {
    fleetService.catalogo().then((c) => setCatalogo(c?.modelos || [])).catch(() => {});
  }, []);
  const porMarca = useMemo(() => catalogo.reduce((acc, m) => ({ ...acc, [m.brand_name]: [...(acc[m.brand_name] || []), m] }), {}), [catalogo]);
  const modeloSel = catalogo.find((m) => String(m.id) === modelId);

  const save = async () => {
    const changed = Object.fromEntries(Object.entries(form).filter(([k, v]) => String(v ?? "") !== String(initial[k] ?? "")));
    const modelChanged = modelId !== initialModel || versionId !== initialVersion;
    if (!Object.keys(changed).length && !modelChanged) return onClose();
    setSaving(true);
    setError(null);
    try {
      if (Object.keys(changed).length) await fleetService.guardar(unit.id, changed);
      if (modelChanged) {
        if (modelId) await fleetService.asignarUnidades(Number(modelId), [Number(unit.id)], versionId ? Number(versionId) : null);
        else await fleetService.quitarModeloDeUnidad(Number(unit.id));
      }
      onSaved(await fleetService.obtener(Number(unit.id)));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const input = (k, t) => {
    const set = (v) => setForm({ ...form, [k]: v });
    if (t === "bool")
      return (
        <button type="button" onClick={() => set(!form[k])} className={`h-6 w-11 rounded-full transition-colors relative ${form[k] ? "bg-brand-navy" : "bg-slate-300 dark:bg-slate-700"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form[k] ? "left-[22px]" : "left-0.5"}`} />
        </button>
      );
    if (t === "catalog")
      return (
        <div className="space-y-2">
          <select value={modelId} onChange={(e) => { setModelId(e.target.value); setVersionId(""); }} className={inputCls}>
            <option value="">— Sin modelo del catálogo —</option>
            {Object.entries(porMarca).map(([marca, modelos]) => (
              <optgroup key={marca} label={marca}>{modelos.map((m) => <option key={m.id} value={m.id}>{m.name}{m.status === "PENDIENTE" ? " (pendiente de aprobación)" : ""}</option>)}</optgroup>
            ))}
          </select>
          {modeloSel?.versions?.length > 0 && (
            <select value={versionId} onChange={(e) => setVersionId(e.target.value)} className={inputCls}>
              <option value="">Sin versión</option>
              {modeloSel.versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
          <p className="text-[11px] text-slate-400">{unit.es_admin ? (catalogo.length ? "Si falta el modelo, se crea en Flota → Catálogo de Modelos." : "El catálogo está vacío: crea los modelos en Flota → Catálogo de Modelos.") : "Si falta el modelo, propónlo en Flota → Catálogo de Modelos (queda pendiente hasta que un admin lo apruebe)."}</p>
        </div>
      );
    if (t === "fleet")
      return (
        <select value={form[k] || ""} onChange={(e) => set(e.target.value)} className={inputCls}>
          <option value="">Sin clasificar</option><option value="LIVIANA">Liviana</option><option value="PESADA">Pesada</option>
        </select>
      );
    if (t === "engine")
      return (
        <>
          <input list="engine-types" value={form[k] ?? ""} onChange={(e) => set(e.target.value)} placeholder="Escribe o elige (ej. 4 cilindros, V6, turbo diésel)" className={inputCls} />
          <datalist id="engine-types">{ENGINE_TYPES.map((x) => <option key={x} value={x} />)}</datalist>
        </>
      );
    if (t === "fuel")
      return (
        <select value={form[k] || ""} onChange={(e) => set(e.target.value)} className={inputCls}>
          <option value="">—</option>{["Gasoil", "Gasolina", "Gas", "Eléctrico"].map((f) => <option key={f}>{f}</option>)}
        </select>
      );
    return <input type={t === "date" ? "date" : t === "number" ? "number" : "text"} step="any" value={form[k] ?? ""} onChange={(e) => set(e.target.value)} className={inputCls} />;
  };

  return (
    createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-[#111216] shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-white/5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Editar ficha</p>
            <h3 className="font-display text-xl text-slate-900 dark:text-white">{unit.code} · {unit.plate || "sin placa"}</h3>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          {sections.map((s) => (
            <section key={s.title}>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-navy dark:text-sky-300 mb-3">{s.title}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {s.fields.map(([k, label, t]) => (
                  <label key={k} className={`block ${t === "bool" ? "sm:col-span-2 flex items-center justify-between gap-3" : t === "catalog" ? "sm:col-span-2" : ""}`}>
                    <span className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{label}</span>
                    {input(k, t)}
                  </label>
                ))}
              </div>
            </section>
          ))}
          <p className="text-xs text-slate-400">El odómetro y el horómetro no se editan aquí: se registran en la pestaña "Lecturas" de la ficha (quedan en su historial).</p>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-3">
          <p className="text-sm text-red-600 truncate">{error}</p>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl" onClick={onClose}>Cancelar</Button>
            <Button disabled={saving} onClick={save} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">{saving ? "Guardando…" : "Guardar cambios"}</Button>
          </div>
        </div>
      </motion.aside>
    </motion.div>,
    document.body,
    )
  );
};

// ---------- Pestañas: fiscal, servicios, notas ----------
// El historial de servicios lo lleva Mantenimiento (ordenes de trabajo de
// Julio): aqui no se muestra para no tener dos historiales. Datos fiscales
// solo en la ficha completa (equipos del contrato PDVSA-Chevron).
const tabsFor = (full) => (full ? [["lecturas", "Lecturas"], ["fiscal", "Datos fiscales y contrato"], ["notas", "Notas"]] : [["lecturas", "Lecturas"], ["notas", "Notas"]]);

const TAB_ICON = { lecturas: Gauge, fiscal: Receipt, notas: StickyNote };

const TabsPanel = ({ unit, full, onChange, canEdit = true }) => {
  const TABS = tabsFor(full);
  const [tab, setTab] = useState(TABS[0][0]);
  const p = unit.profile || {};
  const [nota, setNota] = useState("");
  const notas = unit.eventos.filter((e) => e.event_type === "NOTA");

  const addNota = async (e) => {
    e.preventDefault();
    if (!nota.trim()) return;
    await fleetService.agregarNota(unit.id, nota);
    setNota("");
    onChange();
  };

  return (
    <Panel className="p-0 overflow-hidden">
      <div className="flex gap-1 px-4 pt-4 border-b border-slate-100 dark:border-white/5 overflow-x-auto overflow-y-hidden">
        {TABS.map(([k, l]) => {
          const TI = TAB_ICON[k] || FileText;
          const count = k === "notas" ? notas.length : k === "lecturas" ? (unit.lecturas?.historial || []).filter((h) => !h.voided_at).length : null;
          const on = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)} className={`relative inline-flex items-center gap-2 px-4 py-3 text-sm font-extrabold whitespace-nowrap transition-colors ${on ? "text-brand-navy dark:text-white" : "text-slate-500 hover:text-brand-navy dark:hover:text-slate-200"}`}>
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${on ? "bg-brand-navy text-white shadow-md shadow-brand-navy/20 dark:bg-sky-700" : "bg-slate-100 dark:bg-white/5"}`}><TI size={14} /></span>
              {l}
              {count != null && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${on ? "bg-brand-gold/25 text-amber-800 dark:text-brand-gold" : "bg-slate-100 dark:bg-white/5 text-slate-500"}`}>{count}</span>}
              {on && <motion.span layoutId="fleet-tab" className="absolute left-2 right-2 -bottom-px h-1 rounded-full bg-brand-gold" />}
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="p-6">
          {tab === "lecturas" && <ReadingsPanel unit={unit} canEdit={canEdit} isAdmin={unit.es_admin} onChange={onChange} />}

          {tab === "fiscal" && (
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
              <Field label="Fecha de la orden" value={fmtDate(p.order_date)} />
              <Field label="Fecha de ingreso" value={fmtDate(p.registration_date)} />
              <Field label="Primer contrato" value={fmtDate(p.first_contract_date)} />
              <Field label="Cancelación" value={fmtDate(p.cancellation_date)} />
              <Field label="Impuesto caballos de fuerza" value={fmtMoney(p.hp_tax)} strong={unit.fleet_type === "PESADA"} />
              <Field label="Valor de catálogo" value={fmtMoney(p.catalog_value)} />
              <Field label="Valor de compra" value={fmtMoney(p.purchase_value)} />
              <Field label="Valor residual" value={fmtMoney(p.residual_value)} />
              <Field label="Gerente de la flotilla" value={p.fleet_manager} />
              <Field label="Próximo conductor" value={p.next_driver} />
              <Field label="Etiquetas" value={p.tags} />
            </dl>
          )}

          {tab === "notas" && (
            <div>
              <form onSubmit={addNota} className={`rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-3 mb-5 transition-shadow focus-within:ring-2 focus-within:ring-brand-navy/20 focus-within:shadow-md ${canEdit ? "" : "hidden"}`}>
                <textarea
                  rows={2}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNota(e); }}
                  placeholder="Escribe una nota sobre la unidad: un hallazgo, un pendiente, un acuerdo…"
                  className="w-full resize-none bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none"
                />
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-[11px] text-slate-400">Ctrl + Enter para guardar</span>
                  <Button type="submit" disabled={!nota.trim()} className="rounded-xl h-9 gap-1.5 bg-brand-navy hover:bg-brand-navy-light text-white"><Send size={14} /> Agregar nota</Button>
                </div>
              </form>
              {notas.length === 0 ? (
                <div className="flex flex-col items-center text-center py-8">
                  <span className="h-12 w-12 rounded-2xl bg-brand-navy text-white flex items-center justify-center mb-3 shadow-md shadow-brand-navy/20"><StickyNote size={20} /></span>
                  <p className="text-sm font-extrabold text-brand-navy dark:text-white">Aún no hay notas</p>
                  <p className="text-xs text-slate-500 mt-0.5">Cada nota queda guardada con la fecha y quién la escribió.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {notas.map((n, i) => (
                    <motion.li key={n.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="flex gap-3 rounded-2xl border border-slate-100 dark:border-white/5 border-l-4 border-l-brand-gold bg-white/80 dark:bg-white/[0.02] p-4 hover:shadow-md hover:shadow-brand-navy/5 transition-shadow">
                      <span className="h-9 w-9 rounded-full bg-brand-navy text-white text-xs font-bold flex items-center justify-center shrink-0">{initials(n.created_by || "?")}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs"><b className="text-brand-navy dark:text-white">{n.created_by || "—"}</b> <span className="text-slate-400">· {haceCuanto(n.created_at)} · {fmtDateTime(n.created_at)}</span></p>
                        <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap mt-1">{n.detail || n.title}</p>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Panel>
  );
};

// ---------- Historial (timeline) ----------
const Timeline = ({ unit }) => {
  const items = useMemo(() => {
    const list = unit.eventos.map((e) => ({ ...e, at: e.created_at }));
    if (unit.snapshot?.last_report_at) {
      list.push({ id: "gps", event_type: "GPS", title: `Última señal GPS · ${unit.snapshot.location_text || ""}`.trim(), at: unit.snapshot.last_report_at });
    }
    if (unit.created_at) list.push({ id: "created", event_type: "CREADO", title: "Unidad registrada en el sistema", at: unit.created_at });
    list.sort((a, b) => new Date(b.at) - new Date(a.at));
    const groups = [];
    list.forEach((it) => {
      const day = new Date(it.at).toLocaleDateString("es-VE", { timeZone: "America/Caracas", day: "numeric", month: "long", year: "numeric" });
      const g = groups[groups.length - 1];
      if (g && g.day === day) g.items.push(it);
      else groups.push({ day, items: [it] });
    });
    return groups;
  }, [unit]);

  return (
    <Panel className="lg:sticky lg:top-4 self-start">
      <SectionTitle icon={History}>Actividad</SectionTitle>
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
        {items.map((g) => (
          <div key={g.day}>
            <p className="inline-flex rounded-full bg-brand-navy/10 text-brand-navy dark:bg-white/10 dark:text-sky-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider mb-3">{g.day}</p>
            <ol className="relative border-l-2 border-slate-100 dark:border-white/10 ml-3 space-y-3">
              {g.items.map((it) => {
                const Icon = EVENT_ICON[it.event_type] || Activity;
                return (
                  <li key={it.id} className="ml-5 rounded-xl px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                    <span className={`absolute -left-[14px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white dark:ring-[#0f1115] shadow-sm ${EVENT_TONE[it.event_type] || EVENT_TONE.EDICION}`}>
                      <Icon size={12} />
                    </span>
                    <p className="text-[13px] leading-snug font-semibold text-slate-800 dark:text-slate-100">{it.title}</p>
                    {it.detail && it.event_type !== "NOTA" && <p className="text-xs text-slate-500">{it.detail}</p>}
                    <p className="text-[10px] text-slate-400 mt-0.5">{haceCuanto(it.at)}{it.created_by ? ` · ${it.created_by}` : ""}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </Panel>
  );
};

// ---------- Lo que le falta a la ficha ----------
const ChecklistCard = ({ unit }) => {
  const f = fichaChecklist(unit);
  return (
    <Panel>
      <SectionTitle icon={CheckCircle2} right={
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${f.complete ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-brand-navy text-white dark:bg-sky-700"}`}>{f.complete ? "Completa" : `${f.done} de ${f.total}`}</span>
      }>Ficha</SectionTitle>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${f.pct}%` }} transition={{ duration: 0.7 }} className={`h-full rounded-full ${f.complete ? "bg-emerald-500" : f.pct >= 60 ? "bg-amber-500" : "bg-red-400"}`} />
      </div>
      <p className="text-[11px] font-bold text-slate-500 mt-1.5 mb-3">{f.complete ? "Todo completo." : `Faltan ${f.total - f.done} para completarla.`}</p>
      <ul className="space-y-1.5">
        {f.items.map((it, i) => (
          <motion.li key={it.key} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-sm ${it.ok ? "" : "bg-amber-500/[0.06] border border-amber-500/20"}`}>
            {it.ok ? (
              <span className="mt-0.5 h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0"><Check size={12} strokeWidth={3} /></span>
            ) : (
              <span className="mt-0.5 h-5 w-5 rounded-full border-2 border-amber-400 shrink-0" />
            )}
            <span className="min-w-0">
              <span className={it.ok ? "text-slate-500 dark:text-slate-400" : "font-extrabold text-brand-navy dark:text-white"}>{it.label}</span>
              {it.detail && !it.ok && <span className="block text-[11px] text-slate-500">{it.detail}</span>}
            </span>
          </motion.li>
        ))}
      </ul>
    </Panel>
  );
};

const ManagerRow = ({ unit, onChanged }) => {
  const [assign, setAssign] = useState(false);
  const e = unit.encargado;
  const quitar = async () => {
    await fleetService.quitarEncargado(unit.id);
    onChanged();
  };
  return (
    <div className={`sm:col-span-2 flex items-center gap-3 rounded-2xl border p-3 ${e ? "border-slate-100 dark:border-white/5" : "border-dashed border-amber-400/60 bg-amber-500/[0.04]"}`}>
      <span className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${e ? "bg-brand-gold text-white" : "bg-amber-500 text-white shadow-md shadow-amber-500/20"}`}>{e ? initials(e.nombre) : <UserCog size={16} />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Encargado de la unidad</p>
        <p className={`text-sm font-extrabold truncate ${e ? "text-brand-navy dark:text-white" : "text-amber-600"}`}>{e ? e.nombre : "Sin encargado asignado"}</p>
        {e?.desde && <p className="text-[10px] text-slate-400">Desde {fmtDate(String(e.desde).slice(0, 10))}</p>}
      </div>
      {unit.es_admin && (
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={() => setAssign(true)} className="rounded-xl px-3 py-1.5 text-xs font-bold bg-brand-navy text-white hover:bg-brand-navy-light">{e ? "Cambiar" : "Asignar"}</button>
          {e && <button type="button" onClick={quitar} className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-red-600">Quitar</button>}
        </div>
      )}
      <AnimatePresence>
        {assign && <AssignManagersModal units={[unit]} initialUnitIds={[unit.id]} onClose={() => setAssign(false)} onDone={() => { setAssign(false); onChanged(); }} />}
      </AnimatePresence>
    </div>
  );
};

// ---------- Condicion operativa (politica §4.1) ----------
// La cambiara Mantenimiento al abrir/cerrar una OT. Mientras ese modulo no
// exista, solo un admin la cambia a mano (el backend tambien lo valida).
const StatusControl = ({ unit, onSaved }) => {
  const isAdmin = getCurrentProfile() === "admin";
  const current = statusKeyOf(unit);
  const [picking, setPicking] = useState(null);
  const [cause, setCause] = useState(unit.profile?.status_cause || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const st = STATUS[current];

  const save = async (value, causa) => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await fleetService.guardar(unit.id, { operational_status: value, ...(value === "FUERA_DE_SERVICIO" ? { status_cause: causa } : {}) }));
      setPicking(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const pick = (k) => {
    if (k === current && k !== "FUERA_DE_SERVICIO") return;
    if (k === "FUERA_DE_SERVICIO") return setPicking(k);
    save(k);
  };

  return (
    <div className="flex flex-col items-stretch lg:items-end gap-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Condición operativa</p>
      {isAdmin ? (
        <div className="flex flex-wrap rounded-2xl bg-slate-100 dark:bg-white/5 p-1">
          {Object.entries(STATUS).map(([k, s]) => (
            <button key={k} disabled={saving} onClick={() => pick(k)} title={s.label} className={`relative px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${k === current ? s.on : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"}`}>
              {k === current && <motion.span layoutId="fleet-status" className={`absolute inset-0 rounded-xl ${s.bar}`} />}
              <span className="relative">{s.short}</span>
            </button>
          ))}
        </div>
      ) : (
        <span className={`self-start lg:self-end inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${st.badge}`}><span className={`h-2 w-2 rounded-full ${st.dot}`} />{st.label}</span>
      )}
      {current === "FUERA_DE_SERVICIO" && unit.profile?.status_cause && !picking && <p className="text-xs font-bold text-red-600">Causa: {unit.profile.status_cause}</p>}
      <AnimatePresence>
        {picking && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex gap-2 w-full lg:w-80">
            <input autoFocus list="fleet-causas" value={cause} onChange={(e) => setCause(e.target.value)} placeholder="Causa (ej. En reparación)" className={inputCls} />
            <datalist id="fleet-causas"><option value="En reparación" /><option value="Sin componente mayor" /><option value="Esperando repuesto" /><option value="Documentos vencidos" /></datalist>
            <Button disabled={saving || !cause.trim()} onClick={() => save("FUERA_DE_SERVICIO", cause.trim())} className="rounded-xl bg-red-600 hover:bg-red-700 text-white">Guardar</Button>
            <button onClick={() => setPicking(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className="text-xs text-red-600 max-w-xs">{error}</p>}
      <p className="text-[10px] text-slate-400">{isAdmin ? "Provisional: solo el admin la cambia; luego la cambiará Mantenimiento." : "La cambia Mantenimiento (por ahora, un admin)."}</p>
    </div>
  );
};

// ---------- Pantalla ----------
const FleetDetail = () => {
  useFamilies();
  const { id } = useParams();
  const [unit, setUnit] = useState(null);
  const [alertDays, setAlertDays] = useState(30);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = () => fleetService.obtener(Number(id)).then(setUnit).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    fleetService.getAjustes().then((a) => a?.DOC_ALERT_DAYS && setAlertDays(a.DOC_ALERT_DAYS)).catch(() => {});
  }, [id]);

  if (error && !unit)
    return (
      <PageLayout back={{ to: "/fleet", label: "Fichas de Vehículos" }} icon={Truck} title="Ficha de Vehículo">
        <Card className="p-6 text-red-600">{error}</Card>
      </PageLayout>
    );
  if (!unit)
    return (
      <PageLayout back={{ to: "/fleet", label: "Fichas de Vehículos" }} icon={Truck} title="Ficha de Vehículo">
        <p className="text-center text-slate-400 py-20">Cargando ficha…</p>
      </PageLayout>
    );

  const p = unit.profile || {};
  const st = statusOf(unit);
  const full = isFullSheet(unit);
  const pesada = unit.fleet_type === "PESADA";
  const gps = unit.gps_v3 || {};
  const odo = unit.odometro;
  const interval = Number(unit.maint_interval_effective) || null;
  const mp = maintProgress(odo?.km ?? null, p, interval);
  const live = gpsState(unit.snapshot);
  const modelo = (unit.model_name ? [unit.brand_name, unit.model_name, unit.version_name, p.model_year] : [p.brand, p.model, p.model_year]).filter(Boolean).join(" · ");

  return (
    <PageLayout back={{ to: "/fleet", label: "Fichas de Vehículos" }} icon={Truck} title="Ficha de Vehículo" subtitle={`FLOTA • ${unit.code}`} maxWidth="max-w-[1400px]">
      {/* ===== Encabezado ===== */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`relative overflow-hidden rounded-3xl border border-slate-100 dark:border-white/5 bg-white/80 dark:bg-[#0f1115]/80 backdrop-blur-md p-6 mb-6 ring-1 ${st.ring}`}>
        <div className={`absolute inset-0 bg-gradient-to-r ${st.glow} to-transparent pointer-events-none`} />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <UnitPhoto unit={unit} onChanged={load} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <PlateBadge plate={unit.plate} />
              <div>
                <p className="font-display text-2xl text-slate-900 dark:text-white leading-tight flex items-center gap-2">{unit.code}{p.short_code && <span title="Código de la política" className="font-mono text-xs font-black rounded-md bg-brand-gold/20 text-amber-800 dark:text-brand-gold px-2 py-0.5">{p.short_code}</span>}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{modelo || unit.name || "Ficha técnica pendiente de completar"}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${pesada ? "bg-orange-500/10 text-orange-700 dark:text-orange-400" : "bg-sky-500/10 text-sky-600 dark:text-sky-400"}`}>
                {FLEET_LABEL[unit.fleet_type] || "Flota sin clasificar"}
              </span>
              <span title={full ? "Equipo del contrato PDVSA-Chevron" : "Documentos, km y encargado"} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${full ? "bg-brand-navy text-white" : "bg-slate-500/10 text-slate-600 dark:text-slate-300"}`}>{full ? "Ficha completa · contrato" : "Ficha básica"}</span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${live.cls}`}><span className={`h-2 w-2 rounded-full ${live.dot}`} />GPS: {live.label}</span>
              {paradaInfo(unit.parada) && <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${paradaInfo(unit.parada).cls}`}>⏸ {paradaInfo(unit.parada).txt}</span>}
              <DocsBadge unit={unit} size="lg" onClick={() => [...document.querySelectorAll("h3")].find((h) => /documentación y seguros/i.test(h.innerText))?.scrollIntoView({ behavior: "smooth", block: "start" })} />
            </div>
          </div>
          <div className="flex flex-col items-stretch lg:items-end gap-3">
            <StatusControl unit={unit} onSaved={setUnit} />
            <FichaPdfButton kind="unidad" id={unit.id} />
            {unit.puede_editar ? (
              <Button onClick={() => setEditing(true)} className="rounded-xl font-bold gap-2 bg-brand-navy hover:bg-brand-navy-light text-white">
                <Pencil size={14} /> Editar ficha
              </Button>
            ) : (
              <p className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-white/5 px-3 py-2 text-xs font-bold text-slate-500"><Lock size={13} /> Solo lectura: la completa su encargado</p>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 pb-10">
        <div className="space-y-6 min-w-0">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* ===== ADN ===== */}
            <Panel>
              {(() => {
                const onEdit = unit.puede_editar ? () => setEditing(true) : null;
                const tiles = [
                  { icon: Factory, label: "Marca", value: unit.brand_name || p.brand },
                  { icon: Car, label: "Modelo", value: unit.model_name ? [unit.model_name, unit.version_name].filter(Boolean).join(" · ") : p.model, hint: unit.model_name ? "Del catálogo" : p.model || p.brand ? "Texto libre: elige el modelo del catálogo" : null },
                  unit.model_name && { icon: Layers, label: "Familia", value: unit.model_family_name || categoryLabel(unit.model_category) },
                  unit.model_capacity && { icon: Weight, label: "Capacidad nominal", value: unit.model_capacity },
                  { icon: CalendarDays, label: "Año", value: p.model_year },
                  { icon: Palette, label: "Color", value: p.color, swatch: colorHex(p.color) },
                  { icon: Cog, label: "Tipo de motor", value: p.engine_type },
                  full && { icon: Hash, label: "Serial de motor", value: p.engine_serial, mono: true },
                  !full && { icon: ScanBarcode, label: "Serial de carrocería", value: p.vin, mono: true },
                  { icon: Fuel, label: "Combustible", value: p.fuel_type },
                  full && { icon: Container, label: "Capacidad del tanque", value: unit.tank_capacity_liters ? `${Number(unit.tank_capacity_liters)} L` : null },
                ].filter(Boolean);
                const destacados = full ? [["Serial de carrocería", p.vin, true], ["Impuesto caballos de fuerza", p.hp_tax != null && p.hp_tax !== "" ? fmtMoney(p.hp_tax) : null, false]] : [];
                const all = [...tiles.map((t) => t.value), ...destacados.map((d) => d[1])];
                const llenos = all.filter((v) => !isEmpty(v)).length;
                return (
                  <>
                    <SectionTitle icon={Fingerprint} right={
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden"><motion.span initial={{ width: 0 }} animate={{ width: `${(llenos / all.length) * 100}%` }} className={`block h-full rounded-full ${llenos === all.length ? "bg-emerald-500" : "bg-brand-gold"}`} /></span>
                        <span className="text-[11px] font-bold text-slate-500">{llenos} de {all.length}</span>
                      </span>
                    }>ADN del vehículo</SectionTitle>
                    {full && (
                      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-gradient-to-br from-brand-navy to-[#1f4a6e] text-white p-4 mb-3 shadow-lg shadow-brand-navy/20">
                        {destacados.map(([l, v, mono]) => (
                          <div key={l} className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-200/80">{l}</p>
                            {isEmpty(v) ? (
                              <button type="button" disabled={!onEdit} onClick={onEdit || undefined} className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-amber-300 hover:text-amber-200">Por completar{onEdit && <Plus size={12} />}</button>
                            ) : (
                              <p className={`mt-0.5 text-base font-extrabold truncate ${mono ? "font-mono" : ""}`} title={String(v)}>{v}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {tiles.map((t) => <AdnTile key={t.label} {...t} onEdit={onEdit} />)}
                    </div>
                  </>
                );
              })()}
              <div className="mt-5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 p-4">
                <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-brand-navy dark:text-sky-200 mb-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-navy text-white dark:bg-sky-700"><Cpu size={13} /></span> Equipo GPS
                </p>
                {gps.disponible ? (
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <Field label="Tipo en el GPS" value={gps.tipo_vehiculo} />
                    {gps.bateria != null ? <BatteryBar value={gps.bateria} /> : <Field label="Batería del equipo" value={null} />}
                    <Field label="IMEI" value={gps.imei ? <span className="font-mono">{gps.imei}</span> : null} />
                    <Field label="SIM" value={gps.sim ? <span className="font-mono">{gps.sim}</span> : null} />
                  </dl>
                ) : (
                  <p className="text-xs text-slate-500">{gps.motivo || "Sin datos del equipo GPS."}</p>
                )}
              </div>
            </Panel>

            {/* ===== Estado operativo ===== */}
            <Panel>
              <SectionTitle icon={Gauge}>Estado operativo</SectionTitle>
              <div className="rounded-2xl bg-gradient-to-br from-brand-navy to-[#1f4a6e] text-white p-4 shadow-lg shadow-brand-navy/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-sky-200/80">Odómetro</p>
                    <p className="font-display text-4xl leading-none mt-1">{odo ? Number(odo.km).toLocaleString("es-VE", { maximumFractionDigits: 0 }) : "—"}<span className="text-base text-sky-200/80 ml-1">km</span></p>
                  </div>
                  {odo && (
                    <span className="text-[10px] font-bold rounded-full px-2.5 py-1 bg-white/15 text-white whitespace-nowrap">
                      {odo.fuente === "GPS" ? "Leído del GPS" : `Lectura ${(READING_SOURCE[odo.fuente]?.label || "manual").toLowerCase()}`} · {haceCuanto(odo.fecha)}
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  {mp ? (
                    <>
                      <div className="h-2.5 rounded-full bg-white/15 overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, mp.pct * 100)}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className={`h-full rounded-full ${TONE[mp.tone].bar}`} />
                      </div>
                      <p className="text-xs font-bold mt-1.5 text-white">
                        <Wrench size={12} className="inline -mt-0.5 mr-1" />
                        {mp.remaining > 0 ? `Faltan ${fmtKm(mp.remaining)} para el mantenimiento (a los ${fmtKm(mp.next)})` : `Mantenimiento vencido hace ${fmtKm(-mp.remaining)}`}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-sky-100/80">
                      <Wrench size={12} className="inline -mt-0.5 mr-1" />
                      {odo ? "Registra el último mantenimiento preventivo para ver cuánto falta para el próximo." : "Sin lectura de odómetro todavía."} Intervalo: <b className="text-white">{fmtKm(interval)}</b>.
                    </p>
                  )}
                </div>
              </div>

              {gps.km_por_dia?.length > 0 && <div className="mt-5"><KmSparkline dias={gps.km_por_dia} /></div>}

              <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><DriverTile unit={unit} onChanged={load} /></div>
                <div className="sm:col-span-2"><FrenteTile unit={unit} onChanged={load} /></div>
                <ManagerRow unit={unit} onChanged={load} />
                <div className="sm:col-span-2"><ParadaTile parada={unit.parada} /></div>
                <div className="sm:col-span-2 flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 p-3">
                  <span className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white ${live.dot.replace(" animate-pulse", "")}`}><Radio size={16} /></span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Última ubicación del GPS</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate" title={unit.snapshot?.location_text || ""}>{unit.snapshot?.location_text || "Sin ubicación del GPS"}</p>
                    <p className="text-[10px] text-slate-500">{unit.snapshot?.last_report_at ? `Último reporte ${haceCuanto(unit.snapshot.last_report_at)} · ${fmtDateTime(unit.snapshot.last_report_at)}` : ""}</p>
                  </div>
                </div>
              </div>

              {!pesada && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 rounded-2xl bg-sky-500/5 border border-sky-500/15 p-3">
                    <span className="h-10 w-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-600/20"><Fuel size={16} /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300">Consumo promedio</p>
                      <p className={`font-display text-xl leading-tight ${p.avg_consumption_kml ? "text-brand-navy dark:text-white" : "text-slate-400 text-sm font-sans font-bold"}`}>{p.avg_consumption_kml ? `${Number(p.avg_consumption_kml)} km/L` : "Sin dato"}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-3 rounded-2xl p-3 border ${p.change_plan ? "bg-amber-500/5 border-amber-500/20" : "bg-slate-50 dark:bg-white/[0.03] border-slate-100 dark:border-white/5"}`}>
                    <span className={`h-10 w-10 rounded-xl text-white flex items-center justify-center shrink-0 ${p.change_plan ? "bg-amber-500 shadow-md shadow-amber-500/20" : "bg-slate-400"}`}><Repeat size={16} /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Plan de cambio</p>
                      <p className={`font-display text-xl leading-tight ${p.change_plan ? "text-amber-600" : "text-slate-500"}`}>{p.change_plan ? "Sí, en plan" : "No"}</p>
                    </div>
                  </div>
                </div>
              )}
            </Panel>
          </div>

          <DocumentsPanel unit={unit} alertDays={alertDays} onChange={load} canEdit={unit.puede_editar} />
          <TabsPanel key={full ? "full" : "basic"} unit={unit} full={full} onChange={load} canEdit={unit.puede_editar} />
        </div>

        <div className="space-y-6 self-start min-w-0">
          <ChecklistCard unit={unit} />
          <Timeline unit={unit} />
        </div>
      </div>

      <AnimatePresence>
        {editing && <EditDrawer unit={unit} full={full} onClose={() => setEditing(false)} onSaved={(u) => { setUnit(u); setEditing(false); }} />}
      </AnimatePresence>
    </PageLayout>
  );
};

export default FleetDetail;
