import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { LayoutGrid, Plus, Search, X, Upload, ImagePlus, Link2, Unlink, Pencil, Archive, Check, Gauge, Layers, Truck, ArrowUpRight } from "lucide-react";
import { fleetService, resolveFleetFileUrl } from "@/services";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { useConfirm } from "@/context";
import { PlateBadge, inputCls } from "./fleetParts";
import { CATEGORIES, categoryOf, categoryLabel, EquipmentArt, CategoryGlyph } from "./fleetArt";

const METER_LABEL = { KM: "Kilometraje", HORAS: "Horómetro", AMBOS: "Km + horas" };
const FUELS = ["Gasoil", "Gasolina", "Gas", "Eléctrico"];

// ---------- Foto o ilustracion ----------
const ModelImage = ({ model, className = "", iconClass }) =>
  model.photo_url ? (
    <img src={resolveFleetFileUrl(model.photo_url)} alt={`${model.brand_name} ${model.name}`} className={`object-cover ${className}`} loading="lazy" />
  ) : (
    <EquipmentArt category={model.category} className={className} iconClass={iconClass} />
  );

// ---------- Tarjeta con inclinacion 3D al pasar el cursor ----------
const ModelCard = ({ model, onOpen, index }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 200, damping: 18 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 200, damping: 18 });
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width - 0.5);
    y.set((e.clientY - r.top) / r.height - 0.5);
  };
  const reset = () => { x.set(0); y.set(0); };
  const units = model.units || [];

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index * 0.03, 0.4) }}
      onMouseMove={move}
      onMouseLeave={reset}
      onClick={onOpen}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className="group relative text-left rounded-3xl overflow-hidden bg-white dark:bg-[#0f1115] border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-2xl hover:shadow-brand-navy/10 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <ModelImage model={model} className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-60 group-hover:opacity-100 transition-opacity" />
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur px-2.5 py-1 text-[10px] font-bold text-slate-800 dark:text-white">
          <CategoryGlyph category={model.category} className="w-4 h-3.5" /> {categoryLabel(model.category)}
        </span>
        <span className="absolute top-3 right-3 rounded-full bg-black/50 backdrop-blur px-2.5 py-1 text-[10px] font-bold text-white">{METER_LABEL[model.meter_type]}</span>
        {!model.photo_url && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/80 dark:bg-black/50 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-200"><ImagePlus size={11} /> Sin foto</span>
        )}
        {/* Unidades que usan el modelo: aparecen al pasar el cursor */}
        <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-1.5 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          {units.slice(0, 4).map((u) => (
            <span key={u.id} className="rounded-md bg-white/95 px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-900 shadow">{u.plate || u.code}</span>
          ))}
          {units.length > 4 && <span className="rounded-md bg-brand-gold px-1.5 py-0.5 text-[10px] font-black text-slate-900">+{units.length - 4}</span>}
        </div>
      </div>
      <div className="p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{model.brand_name}</p>
        <p className="font-display text-lg text-slate-900 dark:text-white leading-tight truncate">{model.name}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500 truncate">{[model.body_type, model.capacity, model.versions?.length ? `${model.versions.length} versión${model.versions.length === 1 ? "" : "es"}` : null].filter(Boolean).join(" · ") || "Sin detalles"}</p>
          <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${units.length ? "bg-brand-navy text-white" : "bg-slate-100 dark:bg-white/5 text-slate-400"}`}>
            <Truck size={11} /> {units.length}
          </span>
        </div>
      </div>
    </motion.button>
  );
};

// ---------- Formulario de modelo ----------
const ModelForm = ({ model, brands, categories, onCancel, onSaved }) => {
  const [form, setForm] = useState(() => ({
    brand_name: model?.brand_name || "",
    name: model?.name || "",
    category: model?.category || "GT",
    body_type: model?.body_type || "",
    capacity: model?.capacity || "",
    fuel_type: model?.fuel_type || "",
    meter_type: model?.meter_type || "KM",
    description: model?.description || "",
    versions: (model?.versions || []).map((v) => v.name),
  }));
  const [versionDraft, setVersionDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addVersion = () => {
    const v = versionDraft.trim();
    if (v && !form.versions.some((x) => x.toLowerCase() === v.toLowerCase())) set("versions", [...form.versions, v]);
    setVersionDraft("");
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fleetService.guardarModelo({ ...(model?.id ? { id: model.id } : {}), ...form });
      onSaved(res?.id || model?.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Marca *</span>
          <input required list="fleet-brands" value={form.brand_name} onChange={(e) => set("brand_name", e.target.value)} placeholder="Ej: Grove" className={`${inputCls} mt-1`} />
          <datalist id="fleet-brands">{brands.map((b) => <option key={b.id} value={b.name} />)}</datalist>
        </label>
        <label className="block">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Modelo *</span>
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej: RT760E" className={`${inputCls} mt-1`} />
        </label>
      </div>

      <div>
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Familia</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button type="button" key={c} onClick={() => set("category", c)} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${form.category === c ? "border-brand-navy bg-brand-navy text-white" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-brand-navy/40"}`}>
              <CategoryGlyph category={c} className="w-5 h-4" /> {categoryLabel(c)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block"><span className="text-xs font-bold text-slate-600 dark:text-slate-300">Carrocería / tipo</span><input value={form.body_type} onChange={(e) => set("body_type", e.target.value)} placeholder="Ej: Pick-up" className={`${inputCls} mt-1`} /></label>
        <label className="block"><span className="text-xs font-bold text-slate-600 dark:text-slate-300">Capacidad nominal</span><input value={form.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="Ej: 15 ton" className={`${inputCls} mt-1`} /></label>
        <label className="block"><span className="text-xs font-bold text-slate-600 dark:text-slate-300">Combustible</span>
          <select value={form.fuel_type} onChange={(e) => set("fuel_type", e.target.value)} className={`${inputCls} mt-1`}><option value="">—</option>{FUELS.map((f) => <option key={f}>{f}</option>)}</select>
        </label>
      </div>

      <div>
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Se mide por</span>
        <div className="mt-1.5 inline-flex rounded-xl bg-slate-100 dark:bg-white/5 p-1">
          {Object.entries(METER_LABEL).map(([k, l]) => (
            <button type="button" key={k} onClick={() => set("meter_type", k)} className={`relative px-3 py-1.5 rounded-lg text-xs font-bold ${form.meter_type === k ? "text-white" : "text-slate-500"}`}>
              {form.meter_type === k && <motion.span layoutId="meter-pill" className="absolute inset-0 rounded-lg bg-brand-navy" />}
              <span className="relative">{l}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Versiones</span>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-2">
          <AnimatePresence>
            {form.versions.map((v) => (
              <motion.span key={v} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="inline-flex items-center gap-1 rounded-lg bg-brand-navy/10 dark:bg-white/10 px-2 py-1 text-xs font-bold text-brand-navy dark:text-white">
                {v}<button type="button" onClick={() => set("versions", form.versions.filter((x) => x !== v))} className="opacity-60 hover:opacity-100"><X size={12} /></button>
              </motion.span>
            ))}
          </AnimatePresence>
          <input value={versionDraft} onChange={(e) => setVersionDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addVersion(); } }} onBlur={addVersion} placeholder={form.versions.length ? "Agregar otra…" : "Ej: 4x4 Doble Cabina (Enter para agregar)"} className="flex-1 min-w-[160px] bg-transparent text-sm outline-none px-1 text-slate-900 dark:text-white" />
        </div>
      </div>

      <label className="block"><span className="text-xs font-bold text-slate-600 dark:text-slate-300">Descripción</span><textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} className={`${inputCls} mt-1`} /></label>

      <div className="flex items-center justify-between gap-3 pt-2">
        <p className="text-sm text-red-600">{error}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={saving} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">{saving ? "Guardando…" : model?.id ? "Guardar cambios" : "Crear modelo"}</Button>
        </div>
      </div>
    </form>
  );
};

// ---------- Selector de unidades para asociar ----------
const UnitPicker = ({ model, units, onDone }) => {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(new Set());
  const [versionId, setVersionId] = useState("");
  const [saving, setSaving] = useState(false);
  const linked = new Set((model.units || []).map((u) => u.id));
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return units
      .filter((u) => !linked.has(Number(u.id)))
      .filter((u) => !term || [u.code, u.plate, u.driver_name].some((v) => String(v || "").toLowerCase().includes(term)))
      .map((u) => ({ ...u, sugerida: categoryOf(u.code) === model.category }))
      .sort((a, b) => Number(b.sugerida) - Number(a.sugerida) || String(a.code).localeCompare(String(b.code)));
  }, [units, q, model]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const save = async () => {
    setSaving(true);
    try {
      await fleetService.asignarUnidades(model.id, [...sel], versionId || null);
      onDone(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, placa o conductor…" className={`${inputCls} pl-9`} />
      </div>
      <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-100 dark:border-white/5 divide-y divide-slate-100 dark:divide-white/5">
        {list.length === 0 && <p className="p-4 text-sm text-slate-400 text-center">No hay unidades para asociar.</p>}
        {list.map((u) => {
          const on = sel.has(Number(u.id));
          return (
            <button type="button" key={u.id} onClick={() => toggle(Number(u.id))} className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${on ? "bg-brand-navy/5 dark:bg-white/5" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]"}`}>
              <span className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 ${on ? "bg-brand-navy border-brand-navy text-white" : "border-slate-300 dark:border-slate-600"}`}>{on && <Check size={12} />}</span>
              <span className="font-mono text-xs font-black text-slate-900 dark:text-white w-24 truncate">{u.plate || "—"}</span>
              <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 truncate">{u.code}</span>
              {u.model_name && <span className="text-[10px] text-slate-400 truncate max-w-[120px]">hoy: {u.model_name}</span>}
              {u.sugerida && <span className="text-[10px] font-bold rounded-full bg-brand-gold/20 text-amber-700 dark:text-brand-gold px-2 py-0.5">sugerida</span>}
            </button>
          );
        })}
      </div>
      {model.versions?.length > 0 && (
        <select value={versionId} onChange={(e) => setVersionId(e.target.value)} className={inputCls}>
          <option value="">Sin versión específica</option>
          {model.versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" className="rounded-xl" onClick={() => onDone(false)}>Cancelar</Button>
        <Button disabled={!sel.size || saving} onClick={save} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">{saving ? "Asociando…" : `Asociar ${sel.size || ""} unidad${sel.size === 1 ? "" : "es"}`}</Button>
      </div>
    </div>
  );
};

// ---------- Panel del modelo ----------
const ModelDrawer = ({ model, brands, categories, units, onClose, onChanged, startEditing = false }) => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const fileRef = useRef(null);
  const [mode, setMode] = useState(startEditing || !model?.id ? "edit" : "view");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const isNew = !model?.id;

  const upload = async (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError("La foto debe ser JPG, PNG o WEBP.");
    setUploading(true);
    setError(null);
    try {
      await fleetService.subirFotoModelo(model.id, file);
      onChanged(model.id);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setUploading(false);
    }
  };
  const unlink = async (u) => {
    await fleetService.quitarModeloDeUnidad(u.id);
    onChanged(model.id);
  };
  const archive = async () => {
    if (!(await confirm(`¿Archivar el modelo ${model.brand_name} ${model.name}? Las unidades asociadas lo conservan en su ficha.`, { title: "Archivar modelo", confirmText: "Archivar" }))) return;
    await fleetService.archivarModelo(model.id);
    onChanged(null, true);
  };

  return (
    createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 260, damping: 30 }} onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-[#111216] shadow-2xl flex flex-col">
        {/* Foto grande con zona para soltar una imagen */}
        {!isNew && (
          <div
            className={`relative h-72 shrink-0 overflow-hidden ${dragging ? "ring-4 ring-inset ring-brand-gold" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files?.[0]); }}
          >
            <ModelImage model={model} className="absolute inset-0 w-full h-full" iconClass="w-1/2" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />
            <button onClick={onClose} className="absolute top-4 right-4 h-9 w-9 rounded-xl bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-black/60"><X size={18} /></button>
            <button onClick={() => fileRef.current?.click()} className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-xl bg-white/90 dark:bg-black/60 backdrop-blur px-3 py-2 text-xs font-bold text-slate-900 dark:text-white hover:bg-white">
              <Upload size={14} /> {uploading ? "Subiendo…" : model.photo_url ? "Cambiar foto" : "Subir foto"}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <AnimatePresence>{dragging && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center bg-brand-navy/60 text-white font-bold">Suelta la foto aquí</motion.div>}</AnimatePresence>
            <div className="absolute bottom-5 left-6 right-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-gold">{model.brand_name}</p>
              <h2 className="font-display text-3xl text-white leading-tight">{model.name}</h2>
              <p className="text-sm text-white/80 mt-1 flex items-center gap-2"><CategoryGlyph category={model.category} className="w-5 h-4" /> {categoryLabel(model.category)}</p>
            </div>
          </div>
        )}
        {isNew && (
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-white/5">
            <h3 className="font-display text-xl text-slate-900 dark:text-white">Nuevo modelo</h3>
            <button onClick={onClose} className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18} /></button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {mode === "edit" ? (
            <ModelForm model={model} brands={brands} categories={categories} onCancel={() => (isNew ? onClose() : setMode("view"))} onSaved={(id) => { setMode("view"); onChanged(id); }} />
          ) : mode === "assign" ? (
            <div>
              <h3 className="font-display text-lg text-slate-900 dark:text-white mb-3">Asociar unidades a este modelo</h3>
              <UnitPicker model={model} units={units} onDone={(saved) => { setMode("view"); if (saved) onChanged(model.id); }} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ["Se mide por", METER_LABEL[model.meter_type], Gauge],
                  ["Capacidad", model.capacity || "—", Layers],
                  ["Carrocería", model.body_type || "—", Truck],
                  ["Combustible", model.fuel_type || "—", Gauge],
                ].map(([l, v, Icon]) => (
                  <div key={l} className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400"><Icon size={11} /> {l}</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">{v}</p>
                  </div>
                ))}
              </div>
              {model.description && <p className="text-sm text-slate-600 dark:text-slate-300">{model.description}</p>}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">Versiones</p>
                <div className="flex flex-wrap gap-2">
                  {model.versions?.length ? model.versions.map((v) => <span key={v.id} className="rounded-lg bg-brand-navy/10 dark:bg-white/10 px-2.5 py-1 text-xs font-bold text-brand-navy dark:text-white">{v.name}</span>) : <span className="text-sm text-slate-400">Sin versiones</span>}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Unidades con este modelo · {model.units?.length || 0}</p>
                  <button onClick={() => setMode("assign")} className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy dark:text-sky-300 hover:opacity-80"><Link2 size={14} /> Asociar unidades</button>
                </div>
                {model.units?.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {model.units.map((u) => (
                      <div key={u.id} className="group flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-white/5 px-3 py-2.5">
                        <PlateBadge plate={u.plate} size="sm" />
                        <button onClick={() => navigate(`/fleet/${u.id}`)} className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{u.code}</p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">Abrir ficha <ArrowUpRight size={10} /></p>
                        </button>
                        <button onClick={() => unlink(u)} title="Quitar de este modelo" className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"><Unlink size={15} /></button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button onClick={() => setMode("assign")} className="w-full rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 p-6 text-sm text-slate-500 hover:border-brand-navy/40 hover:text-brand-navy transition-colors">
                    Todavía ninguna unidad usa este modelo. <b>Asociar unidades</b>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {!isNew && mode === "view" && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
            <button onClick={archive} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-500"><Archive size={14} /> Archivar</button>
            <Button onClick={() => setMode("edit")} className="rounded-xl gap-2 bg-brand-navy hover:bg-brand-navy-light text-white"><Pencil size={14} /> Editar modelo</Button>
          </div>
        )}
      </motion.aside>
    </motion.div>,
    document.body,
    )
  );
};

// ---------- Pantalla ----------
const FleetCatalog = () => {
  const [data, setData] = useState({ modelos: [], marcas: [] });
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState("marca");
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () =>
    Promise.all([fleetService.catalogo(), fleetService.listar()])
      .then(([c, u]) => { setData(c || { modelos: [], marcas: [] }); setUnits(Array.isArray(u) ? u : []); })
      .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const modelos = data.modelos || [];
  // Familias: las confirmadas + las que aparecen en los codigos reales de la flota.
  const categories = useMemo(() => {
    const set = new Set(Object.keys(CATEGORIES).filter((k) => k !== "OTRO"));
    units.forEach((u) => set.add(categoryOf(u.code)));
    modelos.forEach((m) => set.add(m.category));
    set.delete("OTRO");
    return [...set, "OTRO"];
  }, [units, modelos]);
  const countBy = useMemo(() => modelos.reduce((acc, m) => ({ ...acc, [m.category]: (acc[m.category] || 0) + 1 }), {}), [modelos]);
  const linkedUnits = units.filter((u) => u.profile?.model_id).length;
  const pct = units.length ? Math.round((linkedUnits / units.length) * 100) : 0;

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = modelos.filter((m) => (!cat || m.category === cat) && (!brand || String(m.brand_id) === brand) && (!term || [m.brand_name, m.name, m.body_type, ...(m.versions || []).map((v) => v.name)].some((v) => String(v || "").toLowerCase().includes(term))));
    if (sort === "unidades") list.sort((a, b) => (b.units?.length || 0) - (a.units?.length || 0));
    return list;
  }, [modelos, q, cat, brand, sort]);

  const open = modelos.find((m) => String(m.id) === String(openId));

  return (
    <PageLayout icon={LayoutGrid} title="Catálogo de Modelos" subtitle="FLOTA • MARCA, MODELO Y VERSIÓN DE CADA EQUIPO" maxWidth="max-w-[1400px]">
      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[["Modelos", modelos.length], ["Marcas", data.marcas?.length || 0], ["Sin foto", modelos.filter((m) => !m.photo_url).length]].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-slate-100 dark:border-white/5 bg-white/70 dark:bg-[#0f1115]/70 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{l}</p>
            <p className="font-display text-2xl text-slate-900 dark:text-white">{v}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-slate-100 dark:border-white/5 bg-white/70 dark:bg-[#0f1115]/70 px-4 py-3 flex items-center gap-3">
          <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90 shrink-0">
            <circle cx="18" cy="18" r="15" fill="none" strokeWidth="4" className="stroke-slate-100 dark:stroke-white/10" />
            <motion.circle cx="18" cy="18" r="15" fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-brand-gold" strokeDasharray="94.2" initial={{ strokeDashoffset: 94.2 }} animate={{ strokeDashoffset: 94.2 - (94.2 * pct) / 100 }} transition={{ duration: 1 }} />
          </svg>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Flota con modelo</p>
            <p className="font-display text-2xl text-slate-900 dark:text-white">{linkedUnits}<span className="text-sm text-slate-400"> / {units.length}</span></p>
          </div>
        </div>
      </div>

      {/* Familias */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {["", ...categories].map((c) => (
          <button key={c || "all"} onClick={() => setCat(c)} className={`relative shrink-0 inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${cat === c ? "text-white" : "text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-white/[0.04] border border-slate-100 dark:border-white/5 hover:border-brand-navy/30"}`}>
            {cat === c && <motion.span layoutId="cat-pill" className="absolute inset-0 rounded-2xl bg-brand-navy" transition={{ type: "spring", stiffness: 300, damping: 28 }} />}
            <span className="relative flex items-center gap-2">
              {c ? <CategoryGlyph category={c} className="w-6 h-5" /> : <span className="inline-flex"><LayoutGrid size={16} /></span>}
              {c ? categoryLabel(c) : "Todos"}
              <span className={`rounded-full px-1.5 text-[10px] ${cat === c ? "bg-white/20" : "bg-slate-100 dark:bg-white/10"}`}>{c ? countBy[c] || 0 : modelos.length}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Herramientas */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar marca, modelo o versión…" className={`${inputCls} pl-9 h-11`} />
        </div>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className={`${inputCls} h-11 lg:w-48`}>
          <option value="">Todas las marcas</option>
          {(data.marcas || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputCls} h-11 lg:w-48`}>
          <option value="marca">Orden: marca y modelo</option>
          <option value="unidades">Orden: más unidades</option>
        </select>
        <Button onClick={() => setCreating(true)} className="h-11 rounded-xl font-bold gap-2 bg-brand-navy hover:bg-brand-navy-light text-white"><Plus size={16} /> Nuevo modelo</Button>
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-16">Cargando catálogo…</p>
      ) : modelos.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10 p-10 text-center">
          <div className="flex justify-center gap-3 mb-5 text-brand-navy/60 dark:text-sky-300/60">
            {["GT", "MT", "CF", "CC", "VEH"].map((c, i) => (
              <motion.div key={c} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 * i }}><CategoryGlyph category={c} className="w-16 h-12" /></motion.div>
            ))}
          </div>
          <h3 className="font-display text-xl text-slate-900 dark:text-white">El catálogo está vacío</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">Crea el primer modelo (por ejemplo, Grove RT760E o Toyota Hilux), súbele una foto y asócialo a sus unidades. Así cada ficha muestra el equipo real.</p>
          <Button onClick={() => setCreating(true)} className="mt-5 rounded-xl font-bold gap-2 bg-brand-navy hover:bg-brand-navy-light text-white"><Plus size={16} /> Crear el primer modelo</Button>
        </motion.div>
      ) : shown.length === 0 ? (
        <p className="text-center text-slate-400 py-16">Ningún modelo coincide con el filtro.</p>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 pb-10">
          <AnimatePresence>
            {shown.map((m, i) => <ModelCard key={m.id} model={m} index={i} onOpen={() => setOpenId(m.id)} />)}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {(open || creating) && (
          <ModelDrawer
            key={open?.id || "new"}
            model={creating ? null : open}
            brands={data.marcas || []}
            categories={categories}
            units={units}
            onClose={() => { setOpenId(null); setCreating(false); }}
            onChanged={async (id, closed) => {
              await load();
              setCreating(false);
              setOpenId(closed ? null : id);
            }}
          />
        )}
      </AnimatePresence>
    </PageLayout>
  );
};

export default FleetCatalog;
