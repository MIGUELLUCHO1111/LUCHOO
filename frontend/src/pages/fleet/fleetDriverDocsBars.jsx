import { motion } from "framer-motion";
import { IdCard, HeartPulse, ScrollText, BadgeCheck, Stamp, ShieldCheck, AlertTriangle, Clock } from "lucide-react";
import { fmtDate } from "./fleetParts";

// Barra de vigencia por documento del conductor (pedido de Lguerra,
// 07/10/2026). Sale sola de las fechas: la barra se llena segun el tiempo que
// le queda (llena = un año o mas), cambia de color al acercarse el vencimiento
// (verde -> amarillo a 30 dias -> rojo vencido) y late cuando hay que actuar.
const ESCALA_DIAS = 365;
const AVISO_DIAS = 30;

const TONE = {
  vigente: { bar: "from-emerald-400 to-emerald-600", text: "text-emerald-600", chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: "bg-emerald-600" },
  por_vencer: { bar: "from-[#FFD84D] to-[#E6A100]", text: "text-amber-600", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300", icon: "bg-amber-500" },
  vencido: { bar: "from-red-400 to-red-600", text: "text-red-600", chip: "bg-red-500/10 text-red-700 dark:text-red-300", icon: "bg-red-600" },
  firmada: { bar: "from-sky-400 to-brand-navy", text: "text-brand-navy dark:text-sky-300", chip: "bg-brand-navy/10 text-brand-navy dark:text-sky-200", icon: "bg-brand-navy" },
  falta: { bar: "", text: "text-slate-500", chip: "bg-slate-100 text-slate-500 dark:bg-white/5", icon: "bg-slate-300 dark:bg-white/15" },
  no_aplica: { bar: "", text: "text-slate-400", chip: "bg-slate-50 text-slate-400 dark:bg-white/5", icon: "bg-slate-200 dark:bg-white/10" },
};

// Cada documento -> { estado, pct, txt, fecha }
const porVencimiento = (fecha, dias, tieneArchivo) => {
  if (!fecha) return tieneArchivo ? { estado: "firmada", pct: 100, txt: "Cargado · sin vencimiento" } : { estado: "falta", pct: 0, txt: "Falta cargar" };
  const n = Number(dias);
  if (n < 0) return { estado: "vencido", pct: 100, txt: `Vencido hace ${Math.abs(n)} d`, fecha };
  const estado = n <= AVISO_DIAS ? "por_vencer" : "vigente";
  const txt = n === 0 ? "Vence hoy" : n <= AVISO_DIAS ? `Vence en ${n} d` : n >= ESCALA_DIAS ? `${Math.floor(n / 30)} meses` : `${n} d`;
  return { estado, pct: Math.max(4, Math.min(100, (n / ESCALA_DIAS) * 100)), txt, fecha };
};

export const vigenciaConductor = (d) => {
  const pesada = d.fleet_type === "PESADA" || d.fleet_type === "AMBAS";
  const cert = !d.heavy_cert_file_url && !d.heavy_cert_expires_at
    ? (pesada ? { estado: "falta", pct: 0, txt: "Falta · requerido" } : { estado: "no_aplica", pct: 0, txt: "No requerido" })
    : porVencimiento(d.heavy_cert_expires_at, d.heavy_cert_days_left, true);
  return [
    { key: "licencia", label: "Licencia", icon: IdCard, ...porVencimiento(d.license_expires_at, d.license_days_left, !!d.license_file_url) },
    { key: "medico", label: "Carta médica", icon: HeartPulse, ...porVencimiento(d.medical_expires_at, d.medical_days_left, !!d.medical_file_url) },
    { key: "autorizacion", label: "Autorización", icon: Stamp, ...(d.auth_file_url ? (d.auth_expires_at ? porVencimiento(d.auth_expires_at, d.auth_days_left, true) : { estado: "firmada", pct: 100, txt: d.auth_signed_at ? `Firmada ${fmtDate(d.auth_signed_at)}` : "Firmada" }) : { estado: "falta", pct: 0, txt: "Falta · requerida" }) },
    { key: "politica", label: "Política", icon: ScrollText, ...(d.policy_file_url ? { estado: "firmada", pct: 100, txt: d.policy_signed_at ? `Firmada ${fmtDate(d.policy_signed_at)}` : "Firmada" } : { estado: "falta", pct: 0, txt: "Falta la firma" }) },
    { key: "pesada", label: "Cert. pesada", icon: BadgeCheck, ...cert },
  ];
};

// Resumen para el encabezado del bloque.
const resumen = (docs) => {
  const vencidos = docs.filter((x) => x.estado === "vencido").length;
  const porVencer = docs.filter((x) => x.estado === "por_vencer").length;
  const faltan = docs.filter((x) => x.estado === "falta").length;
  if (vencidos) return { txt: `${vencidos} vencido${vencidos > 1 ? "s" : ""}`, tone: TONE.vencido, icon: AlertTriangle, alerta: true };
  if (porVencer) return { txt: `${porVencer} por vencer`, tone: TONE.por_vencer, icon: Clock, alerta: true };
  if (faltan) return { txt: `${faltan} por cargar`, tone: TONE.falta, icon: Clock };
  return { txt: "Todo al día", tone: TONE.vigente, icon: ShieldCheck };
};

const Bar = ({ x, i, big }) => {
  const t = TONE[x.estado];
  const Icon = x.icon;
  const alerta = x.estado === "vencido" || x.estado === "por_vencer";
  return (
    <div className="flex items-center gap-2.5" title={`${x.label}: ${x.txt}${x.fecha ? ` (${fmtDate(x.fecha)})` : ""}`}>
      <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.05 + i * 0.07 }}
        className={`${big ? "h-8 w-8" : "h-6 w-6"} rounded-lg flex items-center justify-center shrink-0 text-white shadow-sm ${t.icon}`}>
        <Icon size={big ? 15 : 12} />
      </motion.span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className={`${big ? "text-xs" : "text-[11px]"} font-extrabold text-slate-700 dark:text-slate-200 truncate`}>{x.label}</span>
          <span className={`${big ? "text-xs" : "text-[10px]"} font-black shrink-0 ${t.text}`}>{x.txt}</span>
        </div>
        <div className={`relative ${big ? "h-2.5" : "h-2"} rounded-full overflow-hidden ${x.estado === "falta" ? "border border-dashed border-slate-300 dark:border-white/20 bg-transparent" : "bg-slate-100 dark:bg-white/10"}`}>
          {x.pct > 0 && (
            <motion.div initial={{ width: 0 }} animate={{ width: `${x.pct}%` }} transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={`relative h-full rounded-full bg-gradient-to-r ${t.bar} ${x.estado === "vencido" ? "bg-[length:12px_12px]" : ""}`}>
              {/* Brillo que recorre la barra; en alerta, la barra late */}
              <motion.span className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                initial={{ left: "-35%" }} animate={{ left: "110%" }} transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.4 + i * 0.3, ease: "easeInOut" }} />
              {alerta && <motion.span className="absolute inset-0 rounded-full bg-white" animate={{ opacity: [0, 0.35, 0] }} transition={{ duration: 1.4, repeat: Infinity }} />}
            </motion.div>
          )}
          {/* Marca del aviso de 30 dias sobre la escala de un año */}
          {x.fecha && x.estado !== "vencido" && <span className="absolute inset-y-0 w-px bg-slate-400/60" style={{ left: `${(AVISO_DIAS / ESCALA_DIAS) * 100}%` }} />}
        </div>
      </div>
    </div>
  );
};

export default function DriverDocsBars({ d, big = false, className = "" }) {
  const docs = vigenciaConductor(d);
  const r = resumen(docs);
  const RIcon = r.icon;
  return (
    <div className={`rounded-2xl border border-slate-100 dark:border-white/5 bg-gradient-to-br from-slate-50 to-white dark:from-white/[0.03] dark:to-transparent ${big ? "p-4" : "p-3"} ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Vigencia de documentos</span>
        <motion.span animate={r.alerta ? { scale: [1, 1.06, 1] } : {}} transition={r.alerta ? { duration: 1.5, repeat: Infinity } : {}}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${r.tone.chip}`}>
          <RIcon size={11} /> {r.txt}
        </motion.span>
      </div>
      <div className={`grid ${big ? "grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3" : "grid-cols-1 gap-2"}`}>
        {docs.map((x, i) => <Bar key={x.key} x={x} i={i} big={big} />)}
      </div>
      {big && <p className="mt-3 text-[10px] text-slate-500">La barra llena equivale a un año o más de vigencia; la rayita marca el aviso de 30 días. Se actualiza sola con las fechas de cada documento.</p>}
    </div>
  );
}
