import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, ArrowLeft, Pencil, Gauge, User, MapPin, Phone, FileText, Wrench, StickyNote, Activity,
  Radio, Plus, Trash2, X, Fingerprint, Fuel, Cpu, Repeat, History,
} from "lucide-react";
import { fleetService, resolveFleetFileUrl } from "@/services";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { useConfirm } from "@/context";
import {
  STATUS, statusOf, statusKeyOf, gpsState, PlateBadge, VehicleIcon, FLEET_LABEL, Field, inputCls,
  fmtKm, fmtMoney, fmtDate, fmtDateTime, initials, haceCuanto, maintProgress, TONE,
} from "./fleetParts";
import { categoryLabel } from "./fleetArt";
import DocumentsPanel from "./fleetDocuments";

const EVENT_ICON = {
  CONDUCTOR: User, ESTADO: Activity, UBICACION: MapPin, ODOMETRO: Gauge, MANTENIMIENTO: Wrench,
  DOCUMENTO: FileText, NOTA: StickyNote, EDICION: Pencil, GPS: Radio, CREADO: Plus,
};
const EVENT_TONE = {
  CONDUCTOR: "bg-sky-500/10 text-sky-600", ESTADO: "bg-amber-500/10 text-amber-600", UBICACION: "bg-teal-500/10 text-teal-600",
  ODOMETRO: "bg-indigo-500/10 text-indigo-600", MANTENIMIENTO: "bg-orange-500/10 text-orange-600", DOCUMENTO: "bg-violet-500/10 text-violet-600",
  NOTA: "bg-slate-500/10 text-slate-600", EDICION: "bg-slate-500/10 text-slate-500", GPS: "bg-emerald-500/10 text-emerald-600", CREADO: "bg-brand-navy/10 text-brand-navy",
};

const SectionTitle = ({ icon: Icon, children, right }) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
      <Icon size={14} className="text-brand-navy dark:text-sky-300" />
      {children}
    </h3>
    {right}
  </div>
);

const Panel = ({ children, className = "" }) => (
  <Card className={`p-6 rounded-3xl shadow-sm ${className}`}>{children}</Card>
);

// ---------- Conductor con micro-tarjeta al pasar el cursor ----------
const DriverChip = ({ unit }) => {
  const [open, setOpen] = useState(false);
  const p = unit.profile || {};
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onClick={() => setOpen(!open)}>
      <div className="flex items-center gap-3 cursor-pointer">
        <span className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-navy to-brand-navy-light text-white text-sm font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#0f1115] shadow">
          {initials(unit.driver_name)}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Conductor</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{unit.driver_name || "Sin asignar"}</p>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute z-30 left-0 top-12 w-64 rounded-2xl bg-white dark:bg-[#15171c] border border-slate-100 dark:border-white/10 shadow-2xl p-4"
          >
            <p className="font-bold text-slate-900 dark:text-white">{unit.driver_name || "Sin asignar"}</p>
            <p className="text-xs text-slate-500 mb-3">{p.driver_assigned_at ? `Asignado desde ${fmtDate(p.driver_assigned_at)}` : "Fecha de asignación sin registrar"}</p>
            {p.driver_phone ? (
              <a href={`tel:${p.driver_phone}`} className="flex items-center gap-2 text-sm font-bold text-brand-navy dark:text-sky-300 hover:underline">
                <Phone size={14} /> {p.driver_phone}
              </a>
            ) : (
              <p className="text-xs text-slate-400">Sin teléfono registrado</p>
            )}
            {p.next_driver && <p className="text-xs text-slate-500 mt-3">Próximo conductor: <b>{p.next_driver}</b></p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------- Km por dia (API v3 del GPS) ----------
const KmSparkline = ({ dias }) => {
  if (!dias?.length) return null;
  const last = dias.slice(-30);
  const max = Math.max(...last.map((d) => d.km), 1);
  const total = last.reduce((s, d) => s + d.km, 0);
  return (
    <div>
      <div className="flex items-end justify-between mb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Km por día · últimos {last.length} días</p>
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{fmtKm(total)}</p>
      </div>
      <div className="flex items-end gap-[3px] h-12">
        {last.map((d) => (
          <div key={d.fecha} title={`${fmtDate(d.fecha)}: ${fmtKm(d.km)}`} className="flex-1 rounded-t bg-brand-navy/70 dark:bg-sky-400/70 hover:bg-brand-gold transition-colors" style={{ height: `${Math.max(4, (d.km / max) * 100)}%`, opacity: d.km ? 1 : 0.25 }} />
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
      ["name", "Nombre / descripción"], ["fleet_type", "Tipo de flota", "fleet"], ["driver_name", "Conductor"],
      ["driver_phone", "Teléfono del conductor"], ["driver_assigned_at", "Asignado desde", "date"], ["next_driver", "Próximo conductor"],
      ["assigned_zone", "Zona / centro de costos"], ["fleet_manager", "Gerente de la flotilla"],
    ],
  },
  {
    title: "ADN del vehículo",
    fields: [
      ["__model", "Modelo del catálogo", "catalog"], ["model_year", "Año", "number"], ["color", "Color"],
      ["vin", "Serial de carrocería (chasis)"], ["engine_serial", "Serial de motor"], ["fuel_type", "Combustible", "fuel"], ["tank_capacity_liters", "Capacidad del tanque (L)", "number"],
    ],
  },
  {
    title: "Operación y mantenimiento",
    fields: [
      ["odometer_km", "Odómetro manual (km)", "number"], ["odometer_at", "Fecha de la lectura", "date"],
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

const valueOf = (unit, key) => {
  const v = UNIT_KEYS.includes(key) ? unit[key] : unit.profile?.[key];
  if (v == null) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  return v;
};

const EditDrawer = ({ unit, onClose, onSaved }) => {
  const initial = useMemo(() => {
    const o = {};
    EDIT_SECTIONS.forEach((s) => s.fields.forEach(([k, , t]) => { if (t !== "catalog") o[k] = t === "bool" ? !!unit.profile?.[k] : valueOf(unit, k); }));
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
              <optgroup key={marca} label={marca}>{modelos.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
            ))}
          </select>
          {modeloSel?.versions?.length > 0 && (
            <select value={versionId} onChange={(e) => setVersionId(e.target.value)} className={inputCls}>
              <option value="">Sin versión</option>
              {modeloSel.versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
          <p className="text-[11px] text-slate-400">{catalogo.length ? "Si falta el modelo, se crea en Flota → Catálogo de Modelos." : "El catálogo está vacío: crea los modelos en Flota → Catálogo de Modelos."}</p>
        </div>
      );
    if (t === "fleet")
      return (
        <select value={form[k] || ""} onChange={(e) => set(e.target.value)} className={inputCls}>
          <option value="">Sin clasificar</option><option value="LIVIANA">Liviana</option><option value="PESADA">Pesada</option>
        </select>
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Editar ficha</p>
            <h3 className="font-display text-xl text-slate-900 dark:text-white">{unit.code} · {unit.plate || "sin placa"}</h3>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          {EDIT_SECTIONS.map((s) => (
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
          <p className="text-xs text-slate-400">El odómetro del GPS se lee solo; el manual sirve mientras la API del GPS no tenga esta unidad.</p>
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
const TABS = [["fiscal", "Datos fiscales y contrato"], ["servicios", "Historial de servicios"], ["notas", "Notas"]];

const TabsPanel = ({ unit, onChange }) => {
  const confirm = useConfirm();
  const [tab, setTab] = useState(unit.fleet_type === "PESADA" ? "fiscal" : "servicios");
  const p = unit.profile || {};
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
  const emptySvc = { service_at: today, service_type: "PREVENTIVO", odometer_km: unit.odometro?.km ? Math.round(unit.odometro.km) : "", description: "", workshop: "", cost: "" };
  const [svc, setSvc] = useState(emptySvc);
  const [nota, setNota] = useState("");
  const [error, setError] = useState(null);
  const notas = unit.eventos.filter((e) => e.event_type === "NOTA");

  const addSvc = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await fleetService.registrarServicio(unit.id, svc);
      setSvc(emptySvc);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };
  const delSvc = async (s) => {
    if (!(await confirm(`¿Eliminar el servicio "${s.description}"?`, { title: "Eliminar servicio" }))) return;
    await fleetService.eliminarServicio(s.id);
    onChange();
  };
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
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`relative px-4 py-3 text-sm font-bold whitespace-nowrap transition-colors ${tab === k ? "text-brand-navy dark:text-white" : "text-slate-400 hover:text-slate-600"}`}>
            {l}
            {tab === k && <motion.span layoutId="fleet-tab" className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-brand-gold" />}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="p-6">
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

          {tab === "servicios" && (
            <div>
              <form onSubmit={addSvc} className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-5">
                <input type="date" value={svc.service_at} onChange={(e) => setSvc({ ...svc, service_at: e.target.value })} className={inputCls} />
                <select value={svc.service_type} onChange={(e) => setSvc({ ...svc, service_type: e.target.value })} className={inputCls}>
                  <option value="PREVENTIVO">Preventivo</option><option value="CORRECTIVO">Correctivo</option><option value="OTRO">Otro</option>
                </select>
                <input type="number" placeholder="Km" value={svc.odometer_km} onChange={(e) => setSvc({ ...svc, odometer_km: e.target.value })} className={inputCls} />
                <input required placeholder="Qué se hizo" value={svc.description} onChange={(e) => setSvc({ ...svc, description: e.target.value })} className={`${inputCls} col-span-2 md:col-span-2`} />
                <Button type="submit" className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white"><Plus size={14} /> Registrar</Button>
                <input placeholder="Taller (opcional)" value={svc.workshop} onChange={(e) => setSvc({ ...svc, workshop: e.target.value })} className={`${inputCls} col-span-2 md:col-span-3`} />
                <input type="number" step="any" placeholder="Costo $ (opcional)" value={svc.cost} onChange={(e) => setSvc({ ...svc, cost: e.target.value })} className={`${inputCls} col-span-2 md:col-span-3`} />
              </form>
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              {unit.servicios.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Todavía no hay servicios registrados. Un preventivo reinicia la barra del próximo mantenimiento.</p>
              ) : (
                <ul className="space-y-2">
                  {unit.servicios.map((s) => (
                    <li key={s.id} className="group flex items-center gap-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] px-4 py-3">
                      <span className={`text-[10px] font-bold rounded-full px-2 py-1 ${s.service_type === "PREVENTIVO" ? "bg-emerald-500/10 text-emerald-600" : s.service_type === "CORRECTIVO" ? "bg-orange-500/10 text-orange-600" : "bg-slate-500/10 text-slate-500"}`}>{s.service_type}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{s.description}</p>
                        <p className="text-xs text-slate-500">{[fmtDate(s.service_at), s.odometer_km != null && fmtKm(s.odometer_km), s.workshop, s.cost != null && fmtMoney(s.cost)].filter(Boolean).join(" · ")}</p>
                      </div>
                      <button onClick={() => delSvc(s)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "notas" && (
            <div>
              <form onSubmit={addNota} className="flex gap-2 mb-5">
                <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Escribe una nota sobre la unidad…" className={inputCls} />
                <Button type="submit" className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">Agregar</Button>
              </form>
              {notas.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Sin notas.</p>
              ) : (
                <ul className="space-y-3">
                  {notas.map((n) => (
                    <li key={n.id} className="rounded-2xl border border-slate-100 dark:border-white/5 p-4">
                      <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{n.detail || n.title}</p>
                      <p className="text-[10px] text-slate-400 mt-2">{n.created_by || "—"} · {fmtDateTime(n.created_at)}</p>
                    </li>
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{g.day}</p>
            <ol className="relative border-l border-slate-100 dark:border-white/10 ml-3 space-y-4">
              {g.items.map((it) => {
                const Icon = EVENT_ICON[it.event_type] || Activity;
                return (
                  <li key={it.id} className="ml-5">
                    <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white dark:ring-[#0f1115] ${EVENT_TONE[it.event_type] || EVENT_TONE.EDICION}`}>
                      <Icon size={12} />
                    </span>
                    <p className="text-[13px] leading-snug text-slate-800 dark:text-slate-100">{it.title}</p>
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

// ---------- Pantalla ----------
const FleetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [unit, setUnit] = useState(null);
  const [alertDays, setAlertDays] = useState(30);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const load = () => fleetService.obtener(Number(id)).then(setUnit).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    fleetService.getAjustes().then((a) => a?.DOC_ALERT_DAYS && setAlertDays(a.DOC_ALERT_DAYS)).catch(() => {});
  }, [id]);

  const setStatus = async (value) => {
    setSavingStatus(true);
    try {
      setUnit(await fleetService.guardar(unit.id, { operational_status: value }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingStatus(false);
    }
  };

  if (error && !unit)
    return (
      <PageLayout icon={Truck} title="Ficha de Vehículo">
        <Card className="p-6 text-red-600">{error}</Card>
      </PageLayout>
    );
  if (!unit)
    return (
      <PageLayout icon={Truck} title="Ficha de Vehículo">
        <p className="text-center text-slate-400 py-20">Cargando ficha…</p>
      </PageLayout>
    );

  const p = unit.profile || {};
  const st = statusOf(unit);
  const stKey = statusKeyOf(unit);
  const pesada = unit.fleet_type === "PESADA";
  const gps = unit.gps_v3 || {};
  const odo = unit.odometro;
  const interval = Number(unit.maint_interval_effective) || null;
  const mp = maintProgress(odo?.km ?? null, p, interval);
  const live = gpsState(unit.snapshot);
  const modelo = (unit.model_name ? [unit.brand_name, unit.model_name, unit.version_name, p.model_year] : [p.brand, p.model, p.model_year]).filter(Boolean).join(" · ");

  return (
    <PageLayout icon={Truck} title="Ficha de Vehículo" subtitle={`FLOTA • ${unit.code}`} maxWidth="max-w-[1400px]">
      {/* ===== Encabezado ===== */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`relative overflow-hidden rounded-3xl border border-slate-100 dark:border-white/5 bg-white/80 dark:bg-[#0f1115]/80 backdrop-blur-md p-6 mb-6 ring-1 ${st.ring}`}>
        <div className={`absolute inset-0 bg-gradient-to-r ${st.glow} to-transparent pointer-events-none`} />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <button onClick={() => navigate("/fleet")} className="self-start h-9 w-9 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5" title="Volver a la flota">
            <ArrowLeft size={16} />
          </button>
          <div className={`${unit.model_photo ? "h-28 w-44" : "h-24 w-32"} rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center shrink-0 overflow-hidden shadow-inner`}>
            {unit.model_photo ? (
              <motion.img initial={{ scale: 1.1, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} src={resolveFleetFileUrl(unit.model_photo)} alt={modelo} className="w-full h-full object-cover" />
            ) : (
              <VehicleIcon fleetType={unit.fleet_type} className="w-24 h-16 text-brand-navy dark:text-sky-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <PlateBadge plate={unit.plate} />
              <div>
                <p className="font-display text-2xl text-slate-900 dark:text-white leading-tight">{unit.code}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{modelo || unit.name || "Ficha técnica pendiente de completar"}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${pesada ? "bg-orange-500/10 text-orange-700 dark:text-orange-400" : "bg-sky-500/10 text-sky-600 dark:text-sky-400"}`}>
                {FLEET_LABEL[unit.fleet_type] || "Flota sin clasificar"}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${live.cls}`}><span className={`h-2 w-2 rounded-full ${live.dot}`} />GPS: {live.label}</span>
              {unit.docs_expired > 0 && <span className="rounded-full px-3 py-1 text-xs font-bold bg-red-500/10 text-red-600">Papel vencido</span>}
              {unit.docs_expired === 0 && unit.docs_expiring > 0 && <span className="rounded-full px-3 py-1 text-xs font-bold bg-amber-500/10 text-amber-700">Documento por vencer</span>}
            </div>
          </div>
          <div className="flex flex-col items-stretch lg:items-end gap-3">
            <div className="flex rounded-2xl bg-slate-100 dark:bg-white/5 p-1">
              {Object.entries(STATUS).map(([k, s]) => (
                <button key={k} disabled={savingStatus} onClick={() => k !== stKey && setStatus(k)} className={`relative px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${k === stKey ? "text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"}`}>
                  {k === stKey && <motion.span layoutId="fleet-status" className={`absolute inset-0 rounded-xl ${s.bar}`} />}
                  <span className="relative">{s.label}</span>
                </button>
              ))}
            </div>
            <Button onClick={() => setEditing(true)} className="rounded-xl font-bold gap-2 bg-brand-navy hover:bg-brand-navy-light text-white">
              <Pencil size={14} /> Editar ficha
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 pb-10">
        <div className="space-y-6 min-w-0">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* ===== ADN ===== */}
            <Panel>
              <SectionTitle icon={Fingerprint}>ADN del vehículo</SectionTitle>
              {pesada && (
                <div className="grid grid-cols-2 gap-4 rounded-2xl bg-orange-500/5 border border-orange-500/15 p-4 mb-5">
                  <Field label="Serial de carrocería" value={p.vin} strong />
                  <Field label="Impuesto caballos de fuerza" value={fmtMoney(p.hp_tax)} strong />
                </div>
              )}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Marca" value={unit.brand_name || p.brand} />
                <Field label="Modelo" value={unit.model_name ? [unit.model_name, unit.version_name].filter(Boolean).join(" · ") : p.model} hint={unit.model_name ? "Del catálogo" : p.model || p.brand ? "Texto libre (elige el modelo del catálogo)" : null} />
                {unit.model_name && <Field label="Familia" value={categoryLabel(unit.model_category)} />}
                {unit.model_capacity && <Field label="Capacidad nominal" value={unit.model_capacity} />}
                <Field label="Año" value={p.model_year} />
                <Field label="Color" value={p.color} />
                {!pesada && <Field label="Serial de carrocería" value={p.vin} />}
                <Field label="Serial de motor" value={p.engine_serial} />
                <Field label="Combustible" value={p.fuel_type} />
                <Field label="Capacidad del tanque" value={unit.tank_capacity_liters ? `${Number(unit.tank_capacity_liters)} L` : null} />
              </dl>
              <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/5">
                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3"><Cpu size={12} /> Equipo GPS</p>
                {gps.disponible ? (
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <Field label="Tipo en el GPS" value={gps.tipo_vehiculo} />
                    <Field label="Batería del equipo" value={gps.bateria != null ? `${gps.bateria}%` : null} />
                    <Field label="IMEI" value={gps.imei} />
                    <Field label="SIM" value={gps.sim} />
                  </dl>
                ) : (
                  <p className="text-xs text-slate-400">{gps.motivo || "Sin datos del equipo GPS."}</p>
                )}
              </div>
            </Panel>

            {/* ===== Estado operativo ===== */}
            <Panel>
              <SectionTitle icon={Gauge}>Estado operativo</SectionTitle>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Odómetro</p>
                  <p className="font-display text-4xl text-slate-900 dark:text-white leading-none mt-1">{odo ? Number(odo.km).toLocaleString("es-VE", { maximumFractionDigits: 0 }) : "—"}<span className="text-base text-slate-400 ml-1">km</span></p>
                </div>
                {odo && (
                  <span className={`text-[10px] font-bold rounded-full px-2.5 py-1 ${odo.fuente === "GPS" ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-500"}`}>
                    {odo.fuente === "GPS" ? "Leído del GPS" : "Cargado a mano"} · {odo.fuente === "GPS" ? haceCuanto(odo.fecha) : fmtDate(odo.fecha)}
                  </span>
                )}
              </div>

              <div className="mt-4">
                {mp ? (
                  <>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, mp.pct * 100)}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className={`h-full rounded-full ${TONE[mp.tone].bar}`} />
                    </div>
                    <p className={`text-xs font-bold mt-1.5 ${TONE[mp.tone].text}`}>
                      {mp.remaining > 0 ? `Faltan ${fmtKm(mp.remaining)} para el mantenimiento (a los ${fmtKm(mp.next)})` : `Mantenimiento vencido hace ${fmtKm(-mp.remaining)}`}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">
                    {odo ? "Registra el último mantenimiento preventivo para ver cuánto falta para el próximo." : "Sin lectura de odómetro todavía."} Intervalo: {fmtKm(interval)}.
                  </p>
                )}
              </div>

              {gps.km_por_dia?.length > 0 && <div className="mt-5"><KmSparkline dias={gps.km_por_dia} /></div>}

              <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DriverChip unit={unit} />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Zona asignada</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{p.assigned_zone || "Sin zona"}</p>
                </div>
                <div className="sm:col-span-2 flex items-start gap-2 rounded-2xl bg-slate-50 dark:bg-white/[0.03] p-3">
                  <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 dark:text-slate-100 truncate">{unit.snapshot?.location_text || "Sin ubicación del GPS"}</p>
                    <p className="text-[10px] text-slate-400">{unit.snapshot?.last_report_at ? `Último reporte ${haceCuanto(unit.snapshot.last_report_at)} · ${fmtDateTime(unit.snapshot.last_report_at)}` : ""}</p>
                  </div>
                </div>
              </div>

              {!pesada && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-sky-500/5 border border-sky-500/15 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300"><Fuel size={11} /> Consumo promedio</p>
                    <p className="font-display text-xl text-slate-900 dark:text-white mt-1">{p.avg_consumption_kml ? `${Number(p.avg_consumption_kml)} km/L` : "—"}</p>
                  </div>
                  <div className={`rounded-2xl p-3 border ${p.change_plan ? "bg-amber-500/5 border-amber-500/20" : "bg-slate-50 dark:bg-white/[0.03] border-transparent"}`}>
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500"><Repeat size={11} /> Plan de cambio</p>
                    <p className={`font-display text-xl mt-1 ${p.change_plan ? "text-amber-600" : "text-slate-400"}`}>{p.change_plan ? "Sí, en plan" : "No"}</p>
                  </div>
                </div>
              )}
            </Panel>
          </div>

          <DocumentsPanel unit={unit} alertDays={alertDays} onChange={load} />
          <TabsPanel unit={unit} onChange={load} />
        </div>

        <Timeline unit={unit} />
      </div>

      <AnimatePresence>
        {editing && <EditDrawer unit={unit} onClose={() => setEditing(false)} onSaved={(u) => { setUnit(u); setEditing(false); }} />}
      </AnimatePresence>
    </PageLayout>
  );
};

export default FleetDetail;
