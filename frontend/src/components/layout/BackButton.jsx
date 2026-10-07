import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

/**
 * Boton "Regresar" de Flota y Tracker GPS (pedido de Lguerra, 07/10/2026).
 * Vuelve a la pantalla anterior de la app; si se entro directo por un
 * enlace (no hay pantalla anterior), va a `to`. `label` dice a donde vuelve.
 */
export const BackButton = ({ to = "/dashboard", label = "Inicio", onClick }) => {
  const navigate = useNavigate();
  const go = () => {
    if (onClick) return onClick();
    // react-router guarda el indice del historial: > 0 = hay a donde volver dentro de la app.
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(to);
  };
  return (
    <motion.button
      type="button"
      onClick={go}
      title={`Regresar a ${label}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover="hover"
      whileTap={{ scale: 0.94 }}
      className="group shrink-0 inline-flex items-center gap-2.5 h-12 pl-2 pr-4 rounded-2xl border-2 border-brand-navy/15 dark:border-white/10 bg-white/90 dark:bg-[#0f1115]/90 shadow-sm hover:border-brand-navy hover:shadow-lg hover:shadow-brand-navy/15 transition-colors"
    >
      <motion.span
        variants={{ hover: { x: -4 } }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-navy text-white shadow-md shadow-brand-navy/25 group-hover:bg-brand-gold group-hover:text-slate-900 transition-colors"
      >
        <ArrowLeft size={17} strokeWidth={2.5} />
      </motion.span>
      <span className="text-left leading-tight">
        <span className="block text-sm font-extrabold text-brand-navy dark:text-white">Regresar</span>
        <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 max-w-[11rem] truncate">a {label}</span>
      </span>
    </motion.button>
  );
};

export default BackButton;
