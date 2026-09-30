import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, Search, Check, UserCog, Info } from "lucide-react";
import { fleetService } from "@/services";
import { Button } from "@/components/ui/button";
import { initials, inputCls } from "./fleetParts";
import { categoryOf, categoryLabel } from "./fleetArt";

/**
 * Asignar encargado a varias unidades a la vez (solo admin). El encargado
 * es un usuario con perfil "encargado_flota" (se crea en Seguridad -> Usuarios).
 */
const AssignManagersModal = ({ units, initialUnitIds = [], onClose, onDone }) => {
  const [encargados, setEncargados] = useState(null);
  const [userId, setUserId] = useState("");
  const [sel, setSel] = useState(() => new Set(initialUnitIds.map(Number)));
  const [q, setQ] = useState("");
  const [soloSin, setSoloSin] = useState(!initialUnitIds.length);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fleetService.listarEncargados().then((l) => setEncargados(Array.isArray(l) ? l : [])).catch((e) => { setEncargados([]); setError(e.message); });
  }, []);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return units
      .filter((u) => !soloSin || !u.encargado || sel.has(Number(u.id)))
      .filter((u) => !term || [u.code, u.plate, u.encargado?.nombre, categoryLabel(categoryOf(u.code))].some((v) => String(v || "").toLowerCase().includes(term)));
  }, [units, q, soloSin, sel]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allVisible = list.length > 0 && list.every((u) => sel.has(Number(u.id)));
  const toggleAll = () => setSel((s) => { const n = new Set(s); list.forEach((u) => (allVisible ? n.delete(Number(u.id)) : n.add(Number(u.id)))); return n; });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await fleetService.asignarEncargado([...sel], Number(userId));
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-[#111216] border border-slate-100 dark:border-white/10 shadow-2xl">
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h3 className="font-display text-xl text-slate-900 dark:text-white flex items-center gap-2"><span className="inline-flex"><UserCog size={20} className="text-brand-navy dark:text-sky-300" /></span> Asignar encargado</h3>
            <p className="text-xs text-slate-500 mt-0.5">El encargado completa la ficha de sus unidades y solo puede editar esas.</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5">
          {/* 1. Quien */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">1 · Encargado</p>
            {encargados === null ? (
              <p className="text-sm text-slate-400">Cargando…</p>
            ) : encargados.length === 0 ? (
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-800 dark:text-amber-300 flex gap-3">
                <span className="inline-flex shrink-0 mt-0.5"><Info size={16} /></span>
                <div>
                  <p className="font-bold">Todavía no hay encargados.</p>
                  <p className="mt-1">Crea el usuario de cada encargado en <b>Seguridad → Usuarios</b> y asígnale el perfil <b>encargado_flota</b>. Después aparecerá aquí.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {encargados.map((e) => {
                  const on = String(e.id) === userId;
                  return (
                    <button type="button" key={e.id} onClick={() => setUserId(String(e.id))} className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${on ? "border-brand-navy bg-brand-navy/5 dark:bg-white/5" : "border-slate-100 dark:border-white/5 hover:border-brand-navy/30"}`}>
                      <span className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${on ? "bg-brand-navy text-white" : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-200"}`}>{initials(e.display_name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{e.display_name}</span>
                        <span className="block text-[11px] text-slate-400 truncate">{e.username} · {e.unit_count} unidad{e.unit_count === 1 ? "" : "es"}</span>
                      </span>
                      {on && <span className="inline-flex text-brand-navy dark:text-sky-300"><Check size={16} /></span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Que unidades */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">2 · Unidades ({sel.size} elegidas)</p>
              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                <input type="checkbox" checked={soloSin} onChange={(e) => setSoloSin(e.target.checked)} /> Solo sin encargado
              </label>
            </div>
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, placa, familia o encargado…" className={`${inputCls} pl-9`} />
              </div>
              <Button type="button" variant="outline" className="rounded-xl" onClick={toggleAll}>{allVisible ? "Quitar todas" : "Elegir todas"}</Button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-100 dark:border-white/5 divide-y divide-slate-100 dark:divide-white/5">
              {list.length === 0 && <p className="p-4 text-sm text-slate-400 text-center">No hay unidades con ese filtro.</p>}
              {list.map((u) => {
                const on = sel.has(Number(u.id));
                return (
                  <button type="button" key={u.id} onClick={() => toggle(Number(u.id))} className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${on ? "bg-brand-navy/5 dark:bg-white/5" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]"}`}>
                    <span className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 ${on ? "bg-brand-navy border-brand-navy text-white" : "border-slate-300 dark:border-slate-600"}`}>{on && <Check size={12} />}</span>
                    <span className="font-mono text-xs font-black text-slate-900 dark:text-white w-24 truncate">{u.plate || "—"}</span>
                    <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 truncate">{u.code}</span>
                    <span className="text-[11px] text-slate-400 truncate max-w-[160px]">{u.encargado ? `hoy: ${u.encargado.nombre}` : "sin encargado"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-3">
          <p className="text-sm text-red-600 truncate">{error}</p>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl" onClick={onClose}>Cancelar</Button>
            <Button disabled={!userId || !sel.size || saving} onClick={save} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">{saving ? "Asignando…" : `Asignar a ${sel.size} unidad${sel.size === 1 ? "" : "es"}`}</Button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
};

export default AssignManagersModal;
