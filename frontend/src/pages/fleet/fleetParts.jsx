// Piezas compartidas de Flota -> Fichas de Vehiculos (lista y ficha).

// Condicion operativa de la politica FP-MTTO-PO-01 §4.1 (respuestas de Julio,
// 30/09/2026). La cambiara Mantenimiento al abrir/cerrar una OT; mientras
// tanto solo un admin la cambia a mano (el backend lo valida).
// Colores (pedido de Lguerra, 05/10/2026): En contrato = amarillo Caterpillar,
// Disponible = azul marino. "on" = color de letra sobre el fondo solido.
export const STATUS = {
  OPERATIVO_CONTRATO: {
    label: "Operativo en contrato", short: "En contrato", on: "text-slate-900",
    dot: "bg-[#FFCD11]", badge: "bg-[#FFCD11]/20 text-[#7a5c00] dark:text-[#FFCD11] ring-[#FFCD11]/50",
    bar: "bg-[#FFCD11]", glow: "from-[#FFCD11]/20", ring: "ring-[#FFCD11]/40", kpi: "text-[#a57c00] dark:text-[#FFCD11]",
  },
  DISPONIBLE: {
    label: "Disponible", short: "Disponible", on: "text-white",
    dot: "bg-brand-navy", badge: "bg-brand-navy/10 text-brand-navy dark:text-sky-300 ring-brand-navy/30",
    bar: "bg-brand-navy", glow: "from-brand-navy/15", ring: "ring-brand-navy/25", kpi: "text-brand-navy dark:text-sky-300",
  },
  FUERA_DE_SERVICIO: {
    label: "Fuera de servicio", short: "Fuera de servicio", on: "text-white",
    dot: "bg-red-500", badge: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/30",
    bar: "bg-red-500", glow: "from-red-500/15", ring: "ring-red-500/25", kpi: "text-red-600",
  },
};
export const statusOf = (u) => STATUS[u?.profile?.operational_status] || STATUS.DISPONIBLE;
export const statusKeyOf = (u) => (STATUS[u?.profile?.operational_status] ? u.profile.operational_status : "DISPONIBLE");

// Ficha COMPLETA solo para los equipos del contrato PDVSA-Chevron; el resto
// (incluida la flota Liviana) lleva ficha basica: documentos, km y encargado.
export const CONTRACT_FAMILIES = ["GT", "BA", "MT", "CF", "CC"];
export const unitFamily = (u) => u?.model_category || (String(u?.code || "").toUpperCase().match(/^FP-?([A-Z]+)/) || [])[1] || "OTRO";
export const isFullSheet = (u) => CONTRACT_FAMILIES.includes(unitFamily(u));

export const FLEET_LABEL = { PESADA: "Flota Pesada", LIVIANA: "Flota Liviana" };

// Estado que reporta el GPS (ultima lectura del Tracker).
export const gpsState = (gps) => {
  if (!gps) return { label: "Sin datos GPS", cls: "text-slate-400", dot: "bg-slate-400" };
  if (gps.is_stale) return { label: "Sin señal", cls: "text-slate-500 dark:text-slate-400", dot: "bg-slate-400" };
  if (gps.status === "ACTIVO") return { label: "En movimiento", cls: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500 animate-pulse" };
  return { label: "Estacionada", cls: "text-sky-600 dark:text-sky-400", dot: "bg-sky-500" };
};

export const fmtKm = (n) => (n == null || n === "" ? "—" : `${Number(n).toLocaleString("es-VE", { maximumFractionDigits: 0 })} km`);
export const fmtMoney = (n) => (n == null || n === "" ? "—" : `$${Number(n).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const fmtDate = (s) => {
  if (!s) return "—";
  const [y, m, d] = String(s).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : s;
};
export const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-VE", { timeZone: "America/Caracas", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
};
export const initials = (name) =>
  String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/** Hace cuanto, en palabras ("hace 2 días"). */
export const haceCuanto = (iso) => {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const min = Math.round(ms / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return `hace ${d} día${d === 1 ? "" : "s"}`;
  const mo = Math.round(d / 30);
  return `hace ${mo} mes${mo === 1 ? "" : "es"}`;
};

// Mantenimiento: cuanto se ha recorrido desde el ultimo preventivo frente al
// intervalo (de la unidad o, si no tiene, el de su tipo de flota).
export const maintProgress = (odoKm, profile, interval) => {
  const last = profile?.last_maint_km != null ? Number(profile.last_maint_km) : null;
  if (odoKm == null || last == null || !interval) return null;
  const since = Math.max(0, odoKm - last);
  const pct = since / interval;
  return {
    since,
    pct,
    next: last + interval,
    remaining: last + interval - odoKm,
    tone: pct >= 1 ? "red" : pct >= 0.8 ? "amber" : "emerald",
  };
};

export const TONE = {
  emerald: { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  amber: { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  red: { bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
};

// Documentos: vencido (rojo), por vencer (ambar), vigente (verde).
export const docTone = (daysLeft, alertDays = 30) => {
  if (daysLeft == null) return { label: "Sin vencimiento", cls: "bg-slate-500/10 text-slate-500" };
  if (daysLeft < 0) return { label: `Vencido hace ${Math.abs(daysLeft)} d`, cls: "bg-red-500/10 text-red-600 dark:text-red-400" };
  if (daysLeft <= alertDays) return { label: daysLeft === 0 ? "Vence hoy" : `Vence en ${daysLeft} d`, cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" };
  return { label: "Vigente", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
};

/** Placa con aspecto de matricula (tipografia ancha, borde, franja superior). */
export const PlateBadge = ({ plate, size = "lg" }) => {
  const big = size === "lg";
  return (
    <div
      className={`inline-flex flex-col items-center rounded-lg border-2 border-slate-800/80 dark:border-white/60 bg-white dark:bg-slate-900 shadow-sm ${big ? "px-4 pt-0.5 pb-1" : "px-2 pb-0.5"}`}
    >
      <span className={`font-bold uppercase tracking-[0.3em] text-brand-navy dark:text-sky-300 ${big ? "text-[8px]" : "text-[6px]"}`}>Venezuela</span>
      <span className={`font-mono font-black tracking-[0.12em] text-slate-900 dark:text-white leading-none ${big ? "text-3xl" : "text-sm"}`}>
        {plate || "SIN PLACA"}
      </span>
    </div>
  );
};

/** Silueta minimalista: camion para Pesada, pickup para Liviana. */
export const VehicleIcon = ({ fleetType, className = "w-16 h-16" }) =>
  fleetType === "PESADA" ? (
    <svg viewBox="0 0 64 40" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 29V9a2 2 0 0 1 2-2h29a2 2 0 0 1 2 2v20" />
      <path d="M36 14h11l8 9v6" />
      <path d="M40 14v9h15" />
      <path d="M3 29h58v2" />
      <circle cx="14" cy="32" r="4.5" fill="currentColor" fillOpacity="0.12" />
      <circle cx="25" cy="32" r="4.5" fill="currentColor" fillOpacity="0.12" />
      <circle cx="50" cy="32" r="4.5" fill="currentColor" fillOpacity="0.12" />
      <path d="M8 13h22M8 18h22" opacity="0.35" />
    </svg>
  ) : (
    <svg viewBox="0 0 64 40" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 28v-6a2 2 0 0 1 2-2h22l5-8h14l7 8h4a2 2 0 0 1 2 2v6" />
      <path d="M33 12v8h21" />
      <path d="M4 28h56" />
      <circle cx="16" cy="30" r="5" fill="currentColor" fillOpacity="0.12" />
      <circle cx="48" cy="30" r="5" fill="currentColor" fillOpacity="0.12" />
      <path d="M8 20v-3h18" opacity="0.35" />
    </svg>
  );

export const Field = ({ label, value, strong = false, hint }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className={`mt-0.5 truncate ${strong ? "text-base font-extrabold text-brand-navy dark:text-white" : "text-sm font-semibold text-slate-800 dark:text-slate-100"}`} title={typeof value === "string" ? value : undefined}>
      {value == null || value === "" || value === "—" ? <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Sin dato</span> : value}
    </dd>
    {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
  </div>
);

export const inputCls =
  "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-navy/30";
