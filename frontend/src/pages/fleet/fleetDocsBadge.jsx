import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, FileWarning, FileClock, FileX } from "lucide-react";
import { docsState, docsDetalle } from "./fleetCompleteness";

// Estado de documentos de una unidad, dinamico (pedido de Lguerra,
// 05/10/2026): una rayita por documento obligatorio con su color, el proximo
// vencimiento y, al pasar el mouse o tocarla, la lista de cada documento.
// Todo sale solo de las fechas de vencimiento: nadie lo marca a mano.
const TONE = {
  vencido: { bar: "bg-red-500", text: "text-red-600", label: (d) => `Vencido hace ${Math.abs(d)} d` },
  por_vencer: { bar: "bg-[#FFCD11]", text: "text-amber-700", label: (d) => (d === 0 ? "Vence hoy" : `Vence en ${d} d`) },
  vigente: { bar: "bg-emerald-500", text: "text-emerald-600", label: (d) => (d == null ? "Cargado (no vence)" : `Vigente · ${d} d`) },
  sin_archivo: { bar: "bg-amber-300", text: "text-amber-700", label: () => "Falta el archivo" },
  falta: { bar: "bg-slate-300 dark:bg-white/20", text: "text-slate-500", label: () => "Falta cargar" },
};
const ICON = { vencido: FileX, por_vencer: FileClock, faltan: FileWarning, al_dia: ShieldCheck };

const DocsBadge = ({ unit, size = "md", onClick }) => {
  const [open, setOpen] = useState(false);
  const st = docsState(unit);
  const det = docsDetalle(unit);
  const Icon = ICON[st.key] || FileWarning;
  const alerta = st.key === "vencido" || st.key === "por_vencer";
  const proximo = det.filter((d) => d.days_left != null && d.days_left >= 0).sort((a, b) => a.days_left - b.days_left)[0];
  const big = size === "lg";

  return (
    <span
      role="button"
      tabIndex={0}
      className={`relative ${big ? "inline-flex" : "flex"} flex-col`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); else setOpen((o) => !o); }}
    >
      <motion.span
        animate={alerta ? { scale: [1, 1.025, 1] } : {}}
        transition={alerta ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : {}}
        className={`relative flex items-center gap-2 rounded-xl px-3 ${big ? "py-1.5" : "py-2"} text-xs font-extrabold shadow-md cursor-pointer ${st.cls} ${st.ring}`}
      >
        {alerta && <span className="absolute inset-0 rounded-xl ring-2 ring-current opacity-40 animate-ping pointer-events-none" />}
        <span className="inline-flex shrink-0"><Icon size={15} /></span>
        <span className="min-w-0 flex-1">
          <span className="block leading-tight">{st.label}</span>
          {proximo && st.key !== "vencido" && <span className="block text-[10px] font-bold opacity-80 leading-tight">Próximo vence en {proximo.days_left} d · {proximo.label}</span>}
        </span>
        {det.some((d) => d.required) && (
          <span className="flex items-center gap-0.5 shrink-0" title="Un color por documento obligatorio">
            {det.filter((d) => d.required).map((d, i) => (
              <motion.span key={d.type} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.06 }}
                className={`block w-1.5 h-4 rounded-full ring-1 ring-white/60 ${TONE[d.state].bar}`} />
            ))}
          </span>
        )}
      </motion.span>

      <AnimatePresence>
        {open && det.length > 0 && (
          <motion.span
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute z-40 left-0 bottom-full mb-2 w-72 rounded-2xl bg-white dark:bg-[#15171c] border border-slate-100 dark:border-white/10 shadow-2xl p-3 text-left cursor-default"
          >
            <span className="block text-[10px] font-extrabold uppercase tracking-widest text-brand-navy dark:text-sky-200 mb-2">Documentos de {unit.code}</span>
            {det.map((d) => (
              <span key={d.type} className="flex items-center gap-2 py-1">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${TONE[d.state].bar}`} />
                <span className="flex-1 min-w-0 truncate text-xs font-bold text-slate-800 dark:text-slate-100">{d.label}{!d.required && <span className="font-medium text-slate-400"> · opcional</span>}</span>
                <span className={`text-[11px] font-bold shrink-0 ${TONE[d.state].text}`}>{TONE[d.state].label(d.days_left)}</span>
              </span>
            ))}
            <span className="block mt-2 pt-2 border-t border-slate-100 dark:border-white/5 text-[10px] text-slate-500">Se actualiza solo con la fecha de vencimiento de cada documento (aviso 30 días antes).</span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
};

export default DocsBadge;
