import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { X, Plus, AlertTriangle } from "lucide-react";
import { fleetService } from "@/services";
import { Button } from "@/components/ui/button";
import { VehicleIcon, PlateBadge, inputCls } from "./fleetParts";

// Alta manual de una unidad (pedido de Lguerra, 05/10/2026): Flota -> Fichas
// de Vehiculos es el UNICO lugar donde se crean unidades a mano (Combustible,
// Tracker y Control de Horas ya no). Las que aparecen en el GPS se siguen
// registrando solas. Al crearla se abre su ficha para completarla.
const FLOTAS = [
  ["LIVIANA", "Flota Liviana", "Camionetas, pickups y vehículos de pasajeros", "from-[#1f4a6e] via-brand-navy to-[#0b2236] text-white"],
  ["PESADA", "Flota Pesada", "Grúas, montacargas, camiones y equipos del contrato", "from-[#FFD84D] via-[#FFCD11] to-[#E6B400] text-slate-900"],
];

const NewUnitModal = ({ defaultFleet = "", onClose }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fleet_type: defaultFleet, code: "", plate: "", name: "", driver_name: "", tank_capacity_liters: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.fleet_type) return setError({ message: "Elige si la unidad es de Flota Liviana o Pesada." });
    if (!form.code.trim()) return setError({ message: "Indica el código de la unidad." });
    setSaving(true);
    setError(null);
    try {
      const nueva = await fleetService.crearUnidad(form);
      onClose();
      navigate(`/fleet/${nueva.id}`);
    } catch (err) {
      setError({ message: err.message, existente: err.detail?.existente_id });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.form
        onSubmit={save}
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#111216] border border-slate-100 dark:border-white/10 shadow-2xl p-6"
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="flex items-center gap-2.5 font-display text-xl text-brand-navy dark:text-white">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy text-white"><Plus size={16} /></span> Nueva unidad
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-500 mb-5">Aquí se registran a mano todas las unidades de la flota. Las que aparecen en el GPS se registran solas. Después de crearla se abre su ficha para completar el resto (modelo, documentos, foto…).</p>

        <p className="text-[11px] font-extrabold uppercase tracking-widest text-brand-navy dark:text-sky-200 mb-2">1 · Tipo de flota *</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {FLOTAS.map(([v, title, desc, grad]) => (
            <motion.button key={v} type="button" whileTap={{ scale: 0.98 }} onClick={() => set("fleet_type", v)}
              className={`relative overflow-hidden text-left rounded-2xl p-4 bg-gradient-to-br ${grad} transition-all ${form.fleet_type === v ? "ring-4 ring-emerald-500 shadow-lg" : form.fleet_type ? "opacity-50 hover:opacity-80" : "hover:shadow-lg"}`}>
              <span className="absolute -right-3 -bottom-4 opacity-25"><VehicleIcon fleetType={v} className="w-28 h-16" /></span>
              <span className="relative block font-display text-lg">{title}</span>
              <span className="relative block text-[11px] font-semibold opacity-80">{desc}</span>
              {form.fleet_type === v && <span className="relative mt-2 inline-flex rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-black">Elegida</span>}
            </motion.button>
          ))}
        </div>

        <p className="text-[11px] font-extrabold uppercase tracking-widest text-brand-navy dark:text-sky-200 mb-2">2 · Identificación</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Código de la unidad *
            <input autoFocus value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="Ej. FP-GT.03" className={`${inputCls} mt-1 font-mono`} />
            <span className="block text-[10px] font-medium text-slate-400 mt-0.5">El mismo nombre que tiene (o tendrá) en el GPS.</span>
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Placa
            <input value={form.plate} onChange={(e) => set("plate", e.target.value.toUpperCase())} placeholder="Ej. A47DC3J (vacía si no tiene)" className={`${inputCls} mt-1 font-mono`} />
            <span className="block text-[10px] font-medium text-slate-400 mt-0.5">Con la placa, el GPS la reconoce y le pone su ubicación.</span>
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 sm:col-span-2">Nombre / descripción
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej. Grúa telescópica 50 t" className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Conductor
            <input value={form.driver_name} onChange={(e) => set("driver_name", e.target.value)} placeholder="ROTATIVO si no tiene fijo" className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Capacidad del tanque (L)
            <input type="number" min="0" step="any" value={form.tank_capacity_liters} onChange={(e) => set("tank_capacity_liters", e.target.value)} placeholder="Para Combustible" className={`${inputCls} mt-1`} />
          </label>
        </div>

        {(form.code || form.plate) && (
          <div className="mt-5 flex items-center gap-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 p-3">
            <PlateBadge plate={form.plate || null} size="sm" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Así se verá</p>
              <p className="font-display text-lg text-brand-navy dark:text-white truncate">{form.code || "—"}</p>
              <p className="text-xs text-slate-500 truncate">{form.name || "Ficha técnica pendiente"}</p>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 flex items-start gap-1.5 text-sm font-bold text-red-600">
            <span className="inline-flex mt-0.5"><AlertTriangle size={15} /></span>
            <span>{error.message}{error.existente && <> <button type="button" onClick={() => { onClose(); navigate(`/fleet/${error.existente}`); }} className="underline text-brand-navy dark:text-sky-300">Abrir esa unidad</button></>}</span>
          </p>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving} className="rounded-xl gap-1.5 bg-brand-navy hover:bg-brand-navy-light text-white"><Plus size={15} /> {saving ? "Creando…" : "Crear y abrir su ficha"}</Button>
        </div>
      </motion.form>
    </motion.div>,
    document.body,
  );
};

export default NewUnitModal;
