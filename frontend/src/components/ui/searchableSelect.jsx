import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { Button } from "./button";

// Selector con barra de busqueda -- usado donde una lista de opciones (unidades,
// personas, etc.) es demasiado larga para un <select> nativo o un popover de
// checkboxes simple. `multiple: true` mantiene el comportamiento de filtro
// multi-seleccion (checkboxes); `multiple: false` es un selector simple que
// reemplaza a un <select>.
//
// El panel se renderiza en un portal a document.body (no como hijo del
// boton) a proposito: las Card de esta app usan backdrop-blur, que crea su
// propio stacking context -- un z-index alto adentro de una Card nunca gana
// contra una Card hermana que viene despues en el DOM (como la tabla de
// registro), sin importar que tan alto sea. El portal evita ese problema
// de raiz en vez de perseguir z-index cada vez mas altos.
export function SearchableSelect({
  items,
  getLabel,
  getValue,
  multiple = false,
  value,
  onChange,
  placeholder = "Buscar...",
  allLabel = "Todos",
  emptyMessage = "Sin resultados",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  const updateCoords = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
    const handle = () => updateCoords();
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        panelRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => getLabel(it).toLowerCase().includes(q));
  }, [items, query, getLabel]);

  const triggerLabel = useMemo(() => {
    if (multiple) {
      return value.length === 0 ? allLabel : `${value.length} seleccionada(s)`;
    }
    if (value === "" || value == null) return allLabel;
    const found = items.find((it) => String(getValue(it)) === String(value));
    return found ? getLabel(found) : allLabel;
  }, [multiple, value, items, getValue, getLabel, allLabel]);

  const isChecked = (it) =>
    multiple
      ? value.includes(getValue(it))
      : String(value) === String(getValue(it));

  const handleSelect = (it) => {
    if (multiple) {
      onChange(getValue(it));
    } else {
      onChange(getValue(it));
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        onClick={() => setOpen(!open)}
        className="w-full justify-between rounded-xl text-sm"
      >
        <span className="truncate">{triggerLabel}</span>
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </Button>
      {createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{ position: "fixed", top: coords.top, left: coords.left, width: Math.max(coords.width, 224) }}
              className="z-[9999] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] shadow-xl p-2"
            >
              <div className="relative mb-2">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder={placeholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#15171c] text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
                />
              </div>
              <div className="max-h-52 overflow-auto">
                {!multiple && (
                  <div
                    onClick={() => {
                      onChange("");
                      setOpen(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer text-sm font-bold text-slate-500"
                  >
                    {allLabel}
                  </div>
                )}
                {filtered.map((it) => (
                  <div
                    key={getValue(it)}
                    onClick={() => handleSelect(it)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer text-sm"
                  >
                    {multiple && (
                      <input
                        type="checkbox"
                        checked={isChecked(it)}
                        readOnly
                        className="accent-brand-navy pointer-events-none"
                      />
                    )}
                    <span className={!multiple && isChecked(it) ? "font-bold text-brand-navy dark:text-brand-gold" : ""}>
                      {getLabel(it)}
                    </span>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="px-2 py-1 text-xs text-slate-400">{emptyMessage}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
