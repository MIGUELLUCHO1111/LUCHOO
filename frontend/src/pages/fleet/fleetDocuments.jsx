import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, BadgeCheck, CarFront, Umbrella, ClipboardCheck, Construction, Weight, Zap, ScrollText, FilePlus2, CalendarClock, Route,
  Upload, FileText, Image as ImageIcon, RefreshCw, Trash2, Paperclip, AlertTriangle, ChevronDown,
} from "lucide-react";
import { fleetService, resolveFleetFileUrl } from "@/services";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/context";
import { fmtDate, inputCls } from "./fleetParts";
import { categoryOf, categoryLabel } from "./fleetArt";

// Cada documento con su icono y como se llena. Obligatorios segun Julio
// (30/09/2026, ROADMAP_FLOTA_DETALLE.md §7): vehiculos -> INTT, RCV y permiso;
// GT y BA -> izamiento + prueba de carga; CC -> izamiento + prueba de carga +
// dielectrica. Aviso de papel vencido 30 dias antes (politica §8).
export const DOC_DEFS = {
  RCV: { label: "RCV", long: "Responsabilidad Civil Vehicular", icon: ShieldCheck, number: "N° de póliza", provider: "Aseguradora", expires: true },
  INTT: { label: "Certificado del INTT", long: "Certificado de registro del vehículo", icon: BadgeCheck, number: "N° de certificado", provider: "Emitido por", expires: false },
  PERMISO_CIRCULACION: { label: "Permiso de circulación", long: "Permiso vigente para circular", icon: CarFront, number: "N° de permiso", provider: "Emitido por", expires: true },
  POLIZA: { label: "Póliza de seguro", long: "Seguro de la unidad", icon: Umbrella, number: "N° de póliza", provider: "Aseguradora", expires: true },
  IZAMIENTO: { label: "Certificado de izamiento", long: "Certificación del equipo de izaje", icon: Construction, number: "N° de certificado", provider: "Ente certificador", expires: true },
  PRUEBA_CARGA: { label: "Prueba de carga", long: "Resultado de la prueba de carga", icon: Weight, number: "N° de informe", provider: "Realizada por", expires: true },
  DIELECTRICA: { label: "Prueba dieléctrica", long: "Aislamiento del camión cesta", icon: Zap, number: "N° de informe", provider: "Realizada por", expires: true },
  REVISION: { label: "Revisión técnica", long: "Inspección técnica de la unidad", icon: ClipboardCheck, number: "N° de revisión", provider: "Taller / inspector", expires: true },
  TITULO: { label: "Título de propiedad", long: "Documento de propiedad", icon: ScrollText, number: "N° de título", provider: "Emitido por", expires: false },
  // Pedido de Lguerra (08/10/2026): opcionales con vencimiento.
  TRIMESTRES: { label: "Trimestres vehiculares", long: "Impuesto vehicular trimestral pagado", icon: CalendarClock, number: "N° de planilla / recibo", provider: "Alcaldía", expires: true },
  ROCT: { label: "ROCT", long: "Registro de Operadoras de Transporte de Carga", icon: Route, number: "N° de registro", provider: "Emitido por", expires: true },
  OTRO: { label: "Otro documento", long: "Cualquier otro soporte", icon: FilePlus2, number: "Número", provider: "Emitido por", expires: false },
};
export const docLabel = (t) => DOC_DEFS[t]?.label || t;

// Documentos de vehiculo (circulan por via publica) + los adicionales de la familia.
// Montacargas y cargadores frontales no circulan: no llevan los de vehiculo.
const VEHICLE_DOCS = ["INTT", "RCV", "PERMISO_CIRCULACION"];
const NO_VEHICLE_DOCS = ["MT", "CF"];
export const EXTRA_RULES = [
  { families: ["GT", "BA"], docs: ["IZAMIENTO", "PRUEBA_CARGA"], why: "Equipos de izaje" },
  { families: ["CC"], docs: ["IZAMIENTO", "PRUEBA_CARGA", "DIELECTRICA"], why: "Camión cesta (izaje y trabajo en altura)" },
];
const familyOfUnit = (unit) => unit.model_category || categoryOf(unit.code);
export const requiredFor = (unit) => {
  // Equipos estaticos: no circulan ni llevan placa -> sin documentos de vehiculo.
  if (unit?.fleet_type === "ESTATICO") return [];
  const fam = familyOfUnit(unit);
  const list = NO_VEHICLE_DOCS.includes(fam) ? [] : [...VEHICLE_DOCS];
  EXTRA_RULES.filter((r) => r.families.includes(fam)).forEach((r) => r.docs.forEach((d) => !list.includes(d) && list.push(d)));
  return list;
};

const MAX_MB = 10;
// Solo PDF (pedido de Lguerra, 05/10/2026); el backend tambien lo valida.
const isPdf = (f) => !!f && (f.type === "application/pdf" || /.pdf$/i.test(f.name || ""));

const stateOf = (doc, alertDays) => {
  if (!doc) return { key: "falta", label: "Falta cargar", chip: "bg-slate-500/10 text-slate-500", icon: "bg-brand-navy text-white shadow-md shadow-brand-navy/25 dark:bg-sky-700", ring: "border-dashed border-slate-300 dark:border-white/15" };
  const d = doc.days_left;
  if (d != null && d < 0) return { key: "vencido", label: `Vencido hace ${Math.abs(d)} d`, chip: "bg-red-500/10 text-red-600 dark:text-red-400", icon: "bg-red-600 text-white shadow-md shadow-red-600/25", ring: "border-red-500/40" };
  if (d != null && d <= alertDays) return { key: "por_vencer", label: d === 0 ? "Vence hoy" : `Vence en ${d} d`, chip: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: "bg-amber-500 text-white shadow-md shadow-amber-500/25", ring: "border-amber-500/40" };
  return { key: "vigente", label: d == null ? "Cargado" : "Vigente", chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: "bg-emerald-600 text-white shadow-md shadow-emerald-600/25", ring: "border-emerald-500/30" };
};

// ---------- Formulario de un documento (con su archivo) ----------
const DocForm = ({ unitId, type, onCancel, onSaved }) => {
  const def = DOC_DEFS[type] || DOC_DEFS.OTRO;
  const fileRef = useRef(null);
  const [form, setForm] = useState({ name: type === "OTRO" ? "" : def.label, number: "", provider: "", issued_at: "", expires_at: "" });
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pick = (f) => {
    if (!f) return;
    if (!isPdf(f)) return setError("El documento debe cargarse en PDF.");
    if (f.size > MAX_MB * 1024 * 1024) return setError(`El archivo pesa más de ${MAX_MB} MB.`);
    setError(null);
    setFile(f);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!file) return setError("Adjunta el documento en PDF para que quede respaldado.");
    if (def.expires && !form.expires_at) return setError("Indica la fecha de vencimiento.");
    if (form.issued_at && form.expires_at && form.expires_at < form.issued_at) return setError("El vencimiento no puede ser antes de la emisión.");
    setSaving(true);
    setError(null);
    try {
      const doc = await fleetService.guardarDocumento(unitId, { doc_type: type, ...form, name: form.name || def.label });
      await fleetService.subirArchivoDocumento(doc.id, file);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={save} className="overflow-hidden">
      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
        {type === "OTRO" && <input required placeholder="Nombre del documento" value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input placeholder={def.number} value={form.number} onChange={(e) => set("number", e.target.value)} className={inputCls} />
          <input placeholder={def.provider} value={form.provider} onChange={(e) => set("provider", e.target.value)} className={inputCls} />
          <label className="text-[11px] font-bold text-slate-500">Emitido<input type="date" value={form.issued_at} onChange={(e) => set("issued_at", e.target.value)} className={`${inputCls} mt-1`} /></label>
          <label className="text-[11px] font-bold text-slate-500">Vence{def.expires ? " *" : " (opcional)"}<input type="date" value={form.expires_at} onChange={(e) => set("expires_at", e.target.value)} className={`${inputCls} mt-1`} /></label>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          className={`w-full rounded-2xl border-2 border-dashed px-4 py-4 flex items-center gap-3 text-left transition-colors ${drag ? "border-brand-gold bg-brand-gold/10" : file ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-200 dark:border-white/10 hover:border-brand-navy/40"}`}
        >
          <span className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${file ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-100 dark:bg-white/5 text-slate-400"}`}>
            {file ? (file.type === "application/pdf" ? <FileText size={18} /> : <ImageIcon size={18} />) : <Upload size={18} />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{file ? file.name : "Adjuntar el documento"}</span>
            <span className="block text-[11px] text-slate-400">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · clic para cambiarlo` : `Solo PDF, hasta ${MAX_MB} MB · clic o arrastra aquí`}</span>
          </span>
        </button>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        {error && <p className="flex items-center gap-1.5 text-xs font-bold text-red-600"><AlertTriangle size={13} /> {error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-xl h-9" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={saving} className="rounded-xl h-9 bg-brand-navy hover:bg-brand-navy-light text-white">{saving ? "Guardando…" : `Guardar ${def.label}`}</Button>
        </div>
      </div>
    </motion.form>
  );
};

// ---------- Una casilla por tipo de documento ----------
// compact = mosaico chico para los opcionales; al abrir el formulario la
// casilla ocupa todo el ancho de la grilla.
const DocSlot = ({ unit, type, docs, alertDays, onChange, optional, compact = false, canEdit = true }) => {
  const confirm = useConfirm();
  const attachRef = useRef(null);
  const def = DOC_DEFS[type] || DOC_DEFS.OTRO;
  const Icon = def.icon;
  const [current, ...previous] = docs;
  const st = stateOf(current, alertDays);
  const [open, setOpen] = useState(false);
  const [showPrev, setShowPrev] = useState(false);
  const [busy, setBusy] = useState(false);
  const small = compact && !open;

  const remove = async (d) => {
    if (!(await confirm(`¿Eliminar "${d.name}"${d.expires_at ? ` (vence ${fmtDate(d.expires_at)})` : ""}?`, { title: "Eliminar documento" }))) return;
    await fleetService.eliminarDocumento(d.id);
    onChange();
  };
  const attach = async (f) => {
    if (!f || !current) return;
    if (!isPdf(f)) { window.alert("El documento debe cargarse en PDF."); return; }
    setBusy(true);
    try {
      await fleetService.subirArchivoDocumento(current.id, f);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={open ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={`group rounded-2xl border bg-white/70 dark:bg-white/[0.02] transition-shadow hover:shadow-lg hover:shadow-brand-navy/5 ${small ? "p-3" : "p-4"} ${open ? "col-span-full" : ""} ${st.ring}`}
    >
      <div className="flex items-start gap-3">
        <motion.span whileHover={{ rotate: -8, scale: 1.08 }} className={`${small ? "h-10 w-10 rounded-xl" : "h-12 w-12 rounded-2xl"} flex items-center justify-center shrink-0 transition-colors ${st.icon}`}>
          <Icon size={small ? 18 : 22} />
        </motion.span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={`${small ? "text-sm" : "text-[15px]"} font-extrabold leading-snug text-brand-navy dark:text-white`}>{type === "OTRO" && current ? current.name : def.label}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{current ? [current.number, current.provider].filter(Boolean).join(" · ") || def.long : def.long}</p>
            </div>
          </div>

          {current && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {current.file_url ? (
                <a href={resolveFleetFileUrl(current.file_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-white/5 px-2.5 py-1 text-[11px] font-bold text-brand-navy dark:text-sky-300 hover:bg-brand-navy/10 max-w-[200px]">
                  {current.file_mime === "application/pdf" ? <FileText size={12} /> : <ImageIcon size={12} />}
                  <span className="truncate">{current.file_name || "Ver archivo"}</span>
                </a>
              ) : !canEdit ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400"><Paperclip size={12} /> Falta el archivo</span>
              ) : (
                <button type="button" disabled={busy} onClick={() => attachRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20">
                  <Paperclip size={12} /> {busy ? "Subiendo…" : "Falta el archivo · adjuntar"}
                </button>
              )}
              <input ref={attachRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => attach(e.target.files?.[0])} />
              {current.expires_at && !small && <span className="text-[11px] text-slate-400">Vence {fmtDate(current.expires_at)}</span>}
            </div>
          )}
        </div>
      </div>

      <div className={`${small ? "mt-2.5" : "mt-3"} flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className={`truncate rounded-full px-2 py-0.5 text-[10px] font-bold ${st.chip}`}>{st.label}</span>
          {previous.length > 0 && (
            <button type="button" onClick={() => setShowPrev(!showPrev)} className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 shrink-0">
              <ChevronDown size={12} className={`transition-transform ${showPrev ? "rotate-180" : ""}`} /> {previous.length} anterior{previous.length === 1 ? "" : "es"}
            </button>
          )}
          {current && canEdit && (
            <button type="button" onClick={() => remove(current)} className="text-slate-300 hover:text-red-500 shrink-0" title="Eliminar"><Trash2 size={13} /></button>
          )}
        </div>
        {!open && canEdit && (
          <motion.button whileTap={{ scale: 0.94 }} type="button" onClick={() => setOpen(true)} className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl font-bold transition-colors ${small ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"} ${current ? "text-brand-navy dark:text-sky-300 hover:bg-brand-navy/5" : optional ? "border border-brand-navy/20 text-brand-navy dark:text-sky-300 hover:bg-brand-navy hover:text-white" : "bg-brand-navy text-white hover:bg-brand-navy-light"}`}>
            {current ? <><RefreshCw size={12} /> Renovar</> : <><Upload size={12} /> Cargar</>}
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {showPrev && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2 space-y-1">
            {previous.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-500">
                <span className="truncate">{[d.number, d.expires_at && `vencía ${fmtDate(d.expires_at)}`].filter(Boolean).join(" · ") || d.name}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {d.file_url && <a href={resolveFleetFileUrl(d.file_url)} target="_blank" rel="noreferrer" className="font-bold text-brand-navy dark:text-sky-300">Ver</a>}
                  {canEdit && <button type="button" onClick={() => remove(d)} className="hover:text-red-500"><Trash2 size={12} /></button>}
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && <DocForm unitId={unit.id} type={type} onCancel={() => setOpen(false)} onSaved={() => { setOpen(false); onChange(); }} />}
      </AnimatePresence>
    </motion.div>
  );
};

// ---------- Anillo de avance de los obligatorios ----------
const Ring = ({ value, total }) => {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 1;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <span className="block h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={r} strokeWidth="6" className="fill-none stroke-slate-100 dark:stroke-white/5" />
          <motion.circle
            cx="32" cy="32" r={r} strokeWidth="6" strokeLinecap="round" strokeDasharray={c}
            initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 0.9, ease: "easeOut" }}
            className={`fill-none ${pct === 1 ? "stroke-emerald-500" : pct === 0 ? "stroke-transparent" : "stroke-brand-navy dark:stroke-sky-300"}`}
          />
        </svg>
      </span>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-display text-lg text-slate-900 dark:text-white">{value}/{total}</span>
      </span>
    </div>
  );
};

// ---------- Leyenda unica: que documento pide cada tipo de equipo ----------
// Sale de las mismas reglas que requiredFor (VEHICLE_DOCS, NO_VEHICLE_DOCS,
// EXTRA_RULES), asi la leyenda y las casillas nunca dicen cosas distintas.
const LEGEND = [
  { docs: VEHICLE_DOCS, why: "Circulan por vía pública" },
  { docs: ["IZAMIENTO"], why: "Equipos que levantan carga" },
  { docs: ["PRUEBA_CARGA"], why: "Comprueba la capacidad del equipo de izaje" },
  { docs: ["DIELECTRICA"], why: "Trabajo en altura cerca de líneas eléctricas" },
];
const familiesFor = (doc) => [...new Set(EXTRA_RULES.filter((r) => r.docs.includes(doc)).flatMap((r) => r.families))];

const RulesLegend = ({ unit, required }) => {
  const [open, setOpen] = useState(false);
  const fam = familyOfUnit(unit);
  const famName = categoryLabel(fam);
  const lista = required.map(docLabel);
  const resumen = lista.length > 1 ? `${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}` : lista[0];
  return (
    <div className="mt-6 rounded-2xl border border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02] overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors">
        <span className="min-w-0">
          <span className="block text-xs font-extrabold uppercase tracking-[0.12em] text-brand-navy dark:text-sky-200">¿Qué documentos pide cada equipo?</span>
          <span className="block text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            <b className="text-slate-900 dark:text-white">{famName} ({fam})</b>: {required.length ? `pide ${resumen}.` : "no lleva documentos obligatorios (no circula por vía pública)."}
          </span>
        </span>
        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-brand-navy dark:text-sky-300">
          {open ? "Ocultar" : "Ver detalle"} <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-2">
              {LEGEND.map((row, i) => {
                const vehiculo = row.docs === VEHICLE_DOCS;
                const fams = vehiculo ? [] : familiesFor(row.docs[0]);
                const aplica = row.docs.every((d) => required.includes(d));
                return (
                  <motion.div key={row.docs.join()} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
                    className={`grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)_130px] items-center gap-2 md:gap-4 rounded-xl px-3 py-2.5 border ${aplica ? "border-brand-gold/50 bg-brand-gold/5" : "border-transparent bg-white/70 dark:bg-white/[0.02]"}`}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {row.docs.map((d) => {
                        const D = DOC_DEFS[d].icon;
                        return <span key={d} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"><span className="inline-flex text-brand-navy dark:text-sky-300"><D size={14} /></span>{DOC_DEFS[d].label}</span>;
                      })}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      <span className="block font-bold text-slate-600 dark:text-slate-300">{row.why}</span>
                      {vehiculo ? (
                        <span>Todos los vehículos, <b>excepto</b> {NO_VEHICLE_DOCS.map((c) => `${categoryLabel(c)} (${c})`).join(" y ")}</span>
                      ) : (
                        <span className="flex flex-wrap gap-1 mt-0.5">
                          {fams.map((c) => <span key={c} className={`rounded-md px-1.5 py-0.5 font-bold ${c === fam ? "bg-brand-gold/25 text-amber-800 dark:text-brand-gold" : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300"}`}>{categoryLabel(c)} ({c})</span>)}
                        </span>
                      )}
                    </div>
                    <span className={`justify-self-start md:justify-self-end rounded-full px-2.5 py-0.5 text-[10px] font-bold ${aplica ? "bg-brand-gold/20 text-amber-700 dark:text-brand-gold" : "bg-slate-500/10 text-slate-400"}`}>{aplica ? "Aplica a esta unidad" : "No aplica"}</span>
                  </motion.div>
                );
              })}
              <p className="text-[11px] text-slate-400 px-1 pt-1">Los demás (póliza de seguro, revisión técnica, título de propiedad u otro) son opcionales para cualquier equipo. Criterio acordado con Julio el 30/09/2026.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------- Titulo de seccion ----------
const SectionHead = ({ children, count, note, className = "" }) => (
  <div className={`mb-3 flex items-center gap-2.5 ${className}`}>
    <span className="h-5 w-1.5 rounded-full bg-brand-gold" />
    <span className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-brand-navy dark:text-sky-200">{children}</span>
    <span className="rounded-full bg-brand-navy text-white dark:bg-sky-700 px-2 py-0.5 text-[10px] font-black">{count}</span>
    {note && <span className="hidden sm:inline text-xs font-semibold text-slate-500 dark:text-slate-400">· {note}</span>}
    <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
  </div>
);

// ---------- Panel ----------
const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "falta", label: "Por cargar" },
  { key: "vigente", label: "Vigentes" },
  { key: "por_vencer", label: "Por vencer" },
  { key: "vencido", label: "Vencidos" },
];

const DocumentsPanel = ({ unit, alertDays = 30, onChange, canEdit = true }) => {
  const required = useMemo(() => requiredFor(unit), [unit]);
  const [filter, setFilter] = useState("todos");

  // Documentos agrupados por tipo, el mas reciente primero.
  const byType = useMemo(() => {
    const g = {};
    [...unit.documentos]
      .sort((a, b) => String(b.expires_at || b.created_at || "").localeCompare(String(a.expires_at || a.created_at || "")) || b.id - a.id)
      .forEach((d) => { (g[d.doc_type] = g[d.doc_type] || []).push(d); });
    return g;
  }, [unit.documentos]);

  // Los demas tipos van siempre como casillas fijas (opcionales: no cuentan en "al dia").
  const optionalTypes = Object.keys(DOC_DEFS).filter((t) => !required.includes(t));
  const stateKey = (t) => stateOf(byType[t]?.[0], alertDays).key;
  const states = required.map(stateKey);
  const alDia = states.filter((s) => s === "vigente").length;
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, f.key === "todos" ? required.length + optionalTypes.length : [...required, ...optionalTypes].filter((t) => stateKey(t) === f.key).length]));
  const pass = (t) => filter === "todos" || stateKey(t) === filter;
  const reqShown = required.filter(pass);
  const optShown = optionalTypes.filter(pass);
  const slot = (t, extra) => <DocSlot key={t} unit={unit} type={t} docs={byType[t] || []} alertDays={alertDays} onChange={onChange} canEdit={canEdit} {...extra} />;

  return (
    <Card className="p-6 rounded-3xl shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-4">
          <Ring value={alDia} total={required.length} />
          <div>
            <h3 className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.14em] text-brand-navy dark:text-sky-200">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-navy text-white dark:bg-sky-700"><ShieldCheck size={14} /></span> Documentación y seguros
            </h3>
            <p className="font-display text-2xl text-slate-900 dark:text-white mt-0.5">
              {required.length ? <>{alDia} de {required.length} <span className="text-sm text-slate-400 font-sans">obligatorios al día</span></> : <span className="text-base">Sin documentos obligatorios</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.filter((f) => f.key === "todos" || counts[f.key] > 0).map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={`relative rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${filter === f.key ? "text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100/70 dark:bg-white/5"}`}>
              {filter === f.key && <motion.span layoutId="doc-filter" className="absolute inset-0 rounded-full bg-brand-navy" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">{f.label} <span className="opacity-70">{counts[f.key]}</span></span>
            </button>
          ))}
        </div>
      </div>

      {reqShown.length > 0 && (
        <>
          <SectionHead count={reqShown.length}>Obligatorios para esta unidad</SectionHead>
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
            <AnimatePresence>{reqShown.map((t) => slot(t))}</AnimatePresence>
          </motion.div>
        </>
      )}

      {optShown.length > 0 && (
        <>
          <SectionHead count={optShown.length} note="opcionales, no cuentan en el avance" className={reqShown.length ? "mt-7" : ""}>Otros documentos</SectionHead>
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 items-start">
            <AnimatePresence>{optShown.map((t) => slot(t, { optional: true, compact: true }))}</AnimatePresence>
          </motion.div>
        </>
      )}

      {!reqShown.length && !optShown.length && <p className="text-center text-sm text-slate-400 py-8">No hay documentos en este estado.</p>}

      <RulesLegend unit={unit} required={required} />
    </Card>
  );
};

export default DocumentsPanel;
