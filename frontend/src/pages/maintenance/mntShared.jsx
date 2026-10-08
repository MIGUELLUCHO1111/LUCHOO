import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { getCurrentProfile } from "@/services/api";

// Piezas comunes de Mantenimiento (062_maintenance.sql, política FP-MTTO-PO-01).

export const inputCls =
  "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/30";
export const labelCls = "text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400";

export const STATUS = {
  SOLICITADA: { label: "Solicitada", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  APROBADA: { label: "Aprobada", cls: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300" },
  EN_EJECUCION: { label: "En ejecución", cls: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300" },
  ESPERA_REPUESTO: { label: "Espera de repuesto", cls: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300" },
  EJECUTADA: { label: "Ejecutada · por cerrar", cls: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300" },
  CERRADA: { label: "Cerrada", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  RECHAZADA: { label: "Rechazada", cls: "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300" },
  ANULADA: { label: "Anulada", cls: "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300 line-through" },
};
export const TERMINAL = ["CERRADA", "RECHAZADA", "ANULADA"];

export const KIND = {
  PREVENTIVA: { label: "Preventiva", cls: "bg-brand-navy/10 text-brand-navy dark:bg-white/10 dark:text-white" },
  CORRECTIVA: { label: "Correctiva", cls: "bg-brand-gold/25 text-amber-900 dark:text-brand-gold" },
  EMERGENCIA: { label: "Emergencia", cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
};
export const PRIORITY = {
  BAJA: { label: "Baja", cls: "text-slate-500" },
  MEDIA: { label: "Media", cls: "text-sky-700 dark:text-sky-300" },
  ALTA: { label: "Alta", cls: "text-amber-700 dark:text-amber-400" },
  CRITICA: { label: "Crítica", cls: "text-red-600 dark:text-red-400" },
};
export const CRIT = {
  CRITICO: { label: "Crítico", cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  SEMICRITICO: { label: "Semi-crítico", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  NO_CRITICO: { label: "No crítico", cls: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300" },
};
export const FAILURE = {
  MECANICO: "Mecánico", HIDRAULICO: "Hidráulico", ELECTRICO: "Eléctrico", ESTRUCTURAL: "Estructural", OPERADOR: "Inducido por el operador", OTRO: "Otro",
};
export const ROLE_LABEL = { SUPERVISOR: "Supervisor de Mantenimiento", GERENCIA_MTTO: "Gerencia de Mantenimiento", GERENCIA_OPS: "Gerencia de Operaciones" };
export const INC_STATUS = {
  ABIERTA: { label: "Abierta", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  EN_OT: { label: "En OT", cls: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300" },
  RESUELTA: { label: "Resuelta", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  DESCARTADA: { label: "Descartada", cls: "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300" },
};

export const Chip = ({ map, value, children, className = "" }) => {
  const m = map?.[value];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${m?.cls || "bg-slate-100 text-slate-600"} ${className}`}>
      {children || m?.label || value}
    </span>
  );
};

// Mismas reglas que backend/src/bo/sub_system/classes/mntCommon.js: el
// backend valida cada acción; aquí solo se decide qué botones mostrar.
export const useMntRole = () => {
  const p = String(getCurrentProfile() || "").toLowerCase();
  const isAdmin = p === "admin";
  const isGerencia = isAdmin || p === "gerencia";
  const isSupervisor = isGerencia || p === "supervisor_mantenimiento";
  const roles = isGerencia ? ["SUPERVISOR", "GERENCIA_MTTO", "GERENCIA_OPS"] : isSupervisor ? ["SUPERVISOR"] : [];
  return { profile: p, isAdmin, isGerencia, isSupervisor, roles };
};

export const requiredRoles = (wo) =>
  wo.kind === "CORRECTIVA" ? (wo.level === "MAYOR" ? ["GERENCIA_MTTO", "GERENCIA_OPS"] : ["SUPERVISOR"]) : [];

export const missingRoles = (wo) =>
  wo.status !== "SOLICITADA" ? [] : requiredRoles(wo).filter((r) => !(wo.approvals || []).some((a) => a.role === r && a.decision === "APROBADA"));

const TZ = "America/Caracas";
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-VE", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("es-VE", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
export const usd = (n) => `$${(Number(n) || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0);
export const unitLabel = (u) => [u.code, u.plate && u.plate !== u.code ? u.plate : null].filter(Boolean).join(" · ");

export const Modal = ({ title, icon: Icon, onClose, children, wide = false }) =>
  createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "max-w-4xl" : "max-w-lg"} max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#111216] border border-slate-100 dark:border-white/10 shadow-2xl p-6`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="flex items-center gap-2.5 font-display text-xl text-brand-navy dark:text-white min-w-0">
            {Icon && <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-white"><Icon size={15} /></span>}
            <span className="min-w-0">{title}</span>
          </h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );

export const ErrorBox = ({ children }) =>
  children ? (
    <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">{children}</div>
  ) : null;
