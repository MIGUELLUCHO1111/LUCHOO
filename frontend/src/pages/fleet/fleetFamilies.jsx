import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Check, Sparkles } from "lucide-react";
import { fleetService } from "@/services";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/context";
import { inputCls } from "./fleetParts";
import { ART_OPTIONS, CategoryGlyph, categoryOf } from "./fleetArt";

// Selector de ilustracion: cuadricula de dibujos para elegir con un clic.
const ArtPicker = ({ value, onChange }) => (
  <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5">
    {ART_OPTIONS.map(([k, label]) => (
      <motion.button
        type="button"
        key={k}
        title={label}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onChange(k)}
        className={`rounded-xl border p-1.5 flex items-center justify-center transition-colors ${value === k ? "border-brand-navy bg-brand-navy text-white" : "border-slate-200 dark:border-white/10 text-brand-navy/70 dark:text-sky-200/70 hover:border-brand-navy/40"}`}
      >
        <CategoryGlyph art={k} className="w-9 h-7" />
      </motion.button>
    ))}
  </div>
);

const FamilyRow = ({ fam, unitCount, onSaved, onDeleted }) => {
  const confirm = useConfirm();
  const [name, setName] = useState(fam.name);
  const [art, setArt] = useState(fam.art);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const dirty = name.trim() !== fam.name || art !== fam.art;

  const save = async () => {
    setError(null);
    try {
      await fleetService.guardarFamilia({ code: fam.code, name, art });
      setOpen(false);
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  };
  const remove = async () => {
    if (!(await confirm(`¿Eliminar la familia ${fam.name} (${fam.code})? Las unidades con ese código no se borran.`, { title: "Eliminar familia" }))) return;
    try {
      await fleetService.eliminarFamilia(fam.code);
      onDeleted();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <motion.li layout className="rounded-2xl border border-slate-100 dark:border-white/5 p-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setOpen(!open)} className="h-11 w-14 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-brand-navy dark:text-sky-300 shrink-0" title="Cambiar ilustración">
          <CategoryGlyph art={art} className="w-10 h-8" />
        </button>
        <span className="font-mono text-xs font-black rounded-md bg-brand-navy/10 dark:bg-white/10 text-brand-navy dark:text-white px-2 py-1 shrink-0">{fam.code}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} flex-1 min-w-0`} />
        <span className="hidden sm:block text-[11px] text-slate-400 shrink-0 text-right w-24">{fam.model_count} modelo{fam.model_count === 1 ? "" : "s"}<br />{unitCount} unidad{unitCount === 1 ? "" : "es"}</span>
        {dirty ? (
          <Button onClick={save} className="h-9 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white shrink-0"><Check size={14} /></Button>
        ) : (
          <button type="button" onClick={remove} disabled={fam.model_count > 0} title={fam.model_count > 0 ? "Tiene modelos: cámbialos de familia primero" : "Eliminar"} className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-300 shrink-0"><Trash2 size={15} /></button>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-3"><ArtPicker value={art} onChange={setArt} /></div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </motion.li>
  );
};

/** Crear, renombrar y eliminar familias de equipo. */
const FamilyManager = ({ familias, units, onClose, onChanged }) => {
  const [form, setForm] = useState({ code: "", name: "", art: "truck" });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const unitsByCode = useMemo(() => units.reduce((acc, u) => { const c = categoryOf(u.code); acc[c] = (acc[c] || 0) + 1; return acc; }, {}), [units]);
  // Prefijos que aparecen en los codigos de la flota pero aun no tienen nombre.
  const sinNombre = Object.keys(unitsByCode).filter((c) => c !== "OTRO" && !familias.some((f) => f.code === c)).sort();

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await fleetService.guardarFamilia(form);
      setForm({ code: "", name: "", art: "truck" });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-[#111216] border border-slate-100 dark:border-white/10 shadow-2xl">
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h3 className="font-display text-xl text-slate-900 dark:text-white">Familias de equipo</h3>
            <p className="text-xs text-slate-500 mt-0.5">La familia es el prefijo del código interno de la unidad (FP-<b>GT</b>.06 → GT). Cada una tiene su nombre y su dibujo.</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          <form onSubmit={create} className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] p-4 space-y-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-navy dark:text-sky-300"><Plus size={13} /> Nueva familia</p>
            {sinNombre.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 flex items-center gap-1"><Sparkles size={12} /> En la flota sin nombre:</span>
                {sinNombre.map((c) => (
                  <button type="button" key={c} onClick={() => setForm((f) => ({ ...f, code: c }))} className={`rounded-lg border px-2 py-0.5 font-mono text-[11px] font-black transition-colors ${form.code === c ? "border-brand-navy bg-brand-navy text-white" : "border-dashed border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-300 hover:border-brand-navy"}`}>
                    {c} <span className="font-sans font-normal opacity-60">· {unitsByCode[c]}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2">
              <input required value={form.code} maxLength={10} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="Código (ej. CBA)" className={`${inputCls} font-mono font-bold`} />
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre (ej. Camión con brazo articulado)" className={inputCls} />
            </div>
            <ArtPicker value={form.art} onChange={(art) => setForm({ ...form, art })} />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-red-600">{error}</p>
              <Button type="submit" disabled={saving} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">{saving ? "Guardando…" : "Crear familia"}</Button>
            </div>
          </form>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">Familias ({familias.length})</p>
            <ul className="space-y-2">
              {familias.map((f) => (
                <FamilyRow key={`${f.code}-${f.name}-${f.art}`} fam={f} unitCount={unitsByCode[f.code] || 0} onSaved={onChanged} onDeleted={onChanged} />
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
};

export default FamilyManager;
