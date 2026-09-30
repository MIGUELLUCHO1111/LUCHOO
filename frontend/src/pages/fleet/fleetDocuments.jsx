import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, BadgeCheck, CarFront, Umbrella, ClipboardCheck, Construction, Weight, Zap, ScrollText, FilePlus2,
  Upload, X, FileText, Image as ImageIcon, RefreshCw, Trash2, Paperclip, AlertTriangle, ChevronDown, Plus,
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
  const fam = familyOfUnit(unit);
  const list = NO_VEHICLE_DOCS.includes(fam) ? [] : [...VEHICLE_DOCS];
  EXTRA_RULES.filter((r) => r.families.includes(fam)).forEach((r) => r.docs.forEach((d) => !list.includes(d) && list.push(d)));
  return list;
};

const MAX_MB = 10;
const OK_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const stateOf = (doc, alertDays) => {
  if (!doc) return { key: "falta", label: "Falta cargar", chip: "bg-slate-500/10 text-slate-500", icon: "bg-slate-100 dark:bg-white/5 text-slate-400", ring: "border-dashed border-slate-200 dark:border-white/10" };
  const d = doc.days_left;
  if (d != null && d < 0) return { key: "vencido", label: `Vencido hace ${Math.abs(d)} d`, chip: "bg-red-500/10 text-red-600 dark:text-red-400", icon: "bg-red-500/10 text-red-600", ring: "border-red-500/30" };
  if (d != null && d <= alertDays) return { key: "por_vencer", label: d === 0 ? "Vence hoy" : `Vence en ${d} d`, chip: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: "bg-amber-500/10 text-amber-600", ring: "border-amber-500/30" };
  return { key: "vigente", label: d == null ? "Cargado" : "Vigente", chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: "bg-emerald-500/10 text-emerald-600", ring: "border-slate-100 dark:border-white/5" };
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
    if (!OK_TYPES.includes(f.type)) return setError("El archivo debe ser PDF, JPG, PNG o WEBP.");
    if (f.size > MAX_MB * 1024 * 1024) return setError(`El archivo pesa más de ${MAX_MB} MB.`);
    setError(null);
    setFile(f);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!file) return setError("Adjunta el archivo del documento (PDF o foto) para que quede respaldado.");
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
            <span className="block text-[11px] text-slate-400">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · clic para cambiarlo` : `PDF o foto, hasta ${MAX_MB} MB · clic o arrastra aquí`}</span>
          </span>
        </button>
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
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
const DocSlot = ({ unit, type, docs, alertDays, onChange, optional, canEdit = true }) => {
  const confirm = useConfirm();
  const attachRef = useRef(null);
  const def = DOC_DEFS[type] || DOC_DEFS.OTRO;
  const Icon = def.icon;
  const [current, ...previous] = docs;
  const st = stateOf(current, alertDays);
  const [open, setOpen] = useState(false);
  const [showPrev, setShowPrev] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async (d) => {
    if (!(await confirm(`¿Eliminar "${d.name}"${d.expires_at ? ` (vence ${fmtDate(d.expires_at)})` : ""}?`, { title: "Eliminar documento" }))) return;
    await fleetService.eliminarDocumento(d.id);
    onChange();
  };
  const attach = async (f) => {
    if (!f || !current) return;
    setBusy(true);
    try {
      await fleetService.subirArchivoDocumento(current.id, f);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div layout className={`rounded-2xl border bg-white/60 dark:bg-white/[0.02] p-4 transition-colors ${st.ring}`}>
      <div className="flex items-start gap-3">
        <motion.span whileHover={{ rotate: -6, scale: 1.05 }} className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${st.icon}`}>
          <Icon size={22} />
        </motion.span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{type === "OTRO" && current ? current.name : def.label}</p>
              <p className="text-[11px] text-slate-400 truncate">{current ? [current.number, current.provider].filter(Boolean).join(" · ") || def.long : def.long}{optional && !current ? " · opcional" : ""}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${st.chip}`}>{st.label}</span>
          </div>

          {current && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {current.file_url ? (
                <a href={resolveFleetFileUrl(current.file_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-white/5 px-2.5 py-1 text-[11px] font-bold text-brand-navy dark:text-sky-300 hover:bg-brand-navy/10 max-w-[220px]">
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
              <input ref={attachRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => attach(e.target.files?.[0])} />
              {current.expires_at && <span className="text-[11px] text-slate-400">Vence {fmtDate(current.expires_at)}</span>}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {previous.length > 0 && (
            <button type="button" onClick={() => setShowPrev(!showPrev)} className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600">
              <ChevronDown size={12} className={`transition-transform ${showPrev ? "rotate-180" : ""}`} /> {previous.length} anterior{previous.length === 1 ? "" : "es"}
            </button>
          )}
          {current && canEdit && (
            <button type="button" onClick={() => remove(current)} className="text-slate-300 hover:text-red-500" title="Eliminar"><Trash2 size={13} /></button>
          )}
        </div>
        {!open && canEdit && (
          <button type="button" onClick={() => setOpen(true)} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${current ? "text-brand-navy dark:text-sky-300 hover:bg-brand-navy/5" : "bg-brand-navy text-white hover:bg-brand-navy-light"}`}>
            {current ? <><RefreshCw size={13} /> Renovar</> : <><Upload size={13} /> Cargar</>}
          </button>
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

// ---------- Panel ----------
const DocumentsPanel = ({ unit, alertDays = 30, onChange, canEdit = true }) => {
  const [extra, setExtra] = useState([]);
  const [menu, setMenu] = useState(false);
  const required = useMemo(() => requiredFor(unit), [unit]);

  // Documentos agrupados por tipo, el mas reciente primero.
  const byType = useMemo(() => {
    const g = {};
    [...unit.documentos]
      .sort((a, b) => String(b.expires_at || b.created_at || "").localeCompare(String(a.expires_at || a.created_at || "")) || b.id - a.id)
      .forEach((d) => { (g[d.doc_type] = g[d.doc_type] || []).push(d); });
    return g;
  }, [unit.documentos]);

  const optionalTypes = [...new Set([...Object.keys(byType).filter((t) => !required.includes(t)), ...extra])];
  const addable = Object.keys(DOC_DEFS).filter((t) => !required.includes(t) && !optionalTypes.includes(t));
  const states = required.map((t) => stateOf(byType[t]?.[0], alertDays).key);
  const alDia = states.filter((s) => s === "vigente").length;
  const vencidos = states.filter((s) => s === "vencido").length;
  const porVencer = states.filter((s) => s === "por_vencer").length;
  const faltan = states.filter((s) => s === "falta").length;

  return (
    <Card className="p-6 rounded-3xl shadow-sm">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
        <div>
          <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            <span className="inline-flex"><ShieldCheck size={14} className="text-brand-navy dark:text-sky-300" /></span> Documentación y seguros
          </h3>
          <p className="font-display text-2xl text-slate-900 dark:text-white mt-1">{alDia} de {required.length} <span className="text-sm text-slate-400 font-sans">al día</span></p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-bold">
          {vencidos > 0 && <span className="rounded-full bg-red-500/10 text-red-600 px-2.5 py-1">{vencidos} vencido{vencidos === 1 ? "" : "s"}</span>}
          {porVencer > 0 && <span className="rounded-full bg-amber-500/10 text-amber-700 px-2.5 py-1">{porVencer} por vencer</span>}
          {faltan > 0 && <span className="rounded-full bg-slate-500/10 text-slate-500 px-2.5 py-1">{faltan} por cargar</span>}
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden mb-5 flex">
        {states.map((s, i) => (
          <motion.span key={i} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.05 * i }} style={{ originX: 0 }} className={`h-full flex-1 ${i ? "ml-0.5" : ""} ${s === "vigente" ? "bg-emerald-500" : s === "por_vencer" ? "bg-amber-500" : s === "vencido" ? "bg-red-500" : "bg-transparent"}`} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        {required.map((t) => <DocSlot key={t} unit={unit} type={t} docs={byType[t] || []} alertDays={alertDays} onChange={onChange} canEdit={canEdit} />)}
        {optionalTypes.map((t) => <DocSlot key={t} unit={unit} type={t} docs={byType[t] || []} alertDays={alertDays} onChange={onChange} optional canEdit={canEdit} />)}
      </div>

      <div className={`relative mt-4 ${canEdit ? "" : "hidden"}`}>
        <button type="button" onClick={() => setMenu(!menu)} className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy dark:text-sky-300 hover:opacity-80">
          <Plus size={14} /> Agregar otro documento
        </button>
        <AnimatePresence>
          {menu && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute z-20 mt-2 w-64 rounded-2xl bg-white dark:bg-[#15171c] border border-slate-100 dark:border-white/10 shadow-2xl p-1.5">
              {addable.map((t) => {
                const D = DOC_DEFS[t].icon;
                return (
                  <button key={t} type="button" onClick={() => { setExtra((x) => [...x, t]); setMenu(false); }} className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5">
                    <span className="inline-flex text-slate-400"><D size={16} /></span> {DOC_DEFS[t].label}
                  </button>
                );
              })}
              {!addable.length && <p className="px-3 py-2 text-xs text-slate-400">Ya están todos los tipos.</p>}
              <button type="button" onClick={() => setMenu(false)} className="w-full mt-1 flex items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-[11px] text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"><X size={12} /> Cerrar</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">Documentos adicionales según el tipo de equipo</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {EXTRA_RULES.map((rule) => {
            const applies = rule.families.includes(familyOfUnit(unit));
            return (
              <div key={rule.docs.join()} className={`rounded-2xl p-3 border ${applies ? "border-brand-gold/50 bg-brand-gold/5" : "border-slate-100 dark:border-white/5"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {rule.docs.map((d) => {
                      const D = DOC_DEFS[d].icon;
                      return <span key={d} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"><span className="inline-flex text-brand-navy dark:text-sky-300"><D size={14} /></span>{DOC_DEFS[d].label}</span>;
                    })}
                  </div>
                  {applies && <span className="shrink-0 rounded-full bg-brand-gold/20 text-amber-700 dark:text-brand-gold px-2 py-0.5 text-[10px] font-bold">Aplica a esta unidad</span>}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">{rule.why}: {rule.families.map((c) => `${categoryLabel(c)} (${c})`).join(", ")}.</p>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">Certificado del INTT, RCV y Permiso de circulación aplican a los vehículos (no a montacargas ni cargadores frontales). La póliza de seguro se agrega como opcional con "Agregar otro documento". Criterio acordado con Julio el 30/09/2026.</p>
      </div>
    </Card>
  );
};

export default DocumentsPanel;
