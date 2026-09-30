import { useEffect, useState } from "react";
import { fleetService } from "@/services";

// Familias de equipo (prefijo del codigo interno) e ilustraciones para el
// Catalogo de Flota. Las familias viven en la tabla fleet_family (se crean y
// renombran desde el Catalogo); setFamilies() las registra aqui para que
// categoryLabel() y las ilustraciones las usen en todas las pantallas.
// CATEGORIES queda como respaldo mientras no ha cargado la lista.

export const CATEGORIES = {
  GT: { label: "Grúa telescópica", art: "crane" },
  BA: { label: "Brazo articulado", art: "knuckle" },
  MT: { label: "Montacargas", art: "forklift" },
  CF: { label: "Cargador frontal", art: "loader" },
  CC: { label: "Camión cesta", art: "bucket" },
  VEH: { label: "Vehículo", art: "pickup" },
};

/** Ilustraciones que se pueden elegir para una familia (mismas claves que acepta el backend). */
export const ART_OPTIONS = [
  ["crane", "Grúa"], ["knuckle", "Brazo articulado"], ["forklift", "Montacargas"], ["loader", "Cargador"],
  ["bucket", "Cesta"], ["pickup", "Pickup"], ["truck", "Camión"], ["tanker", "Cisterna"], ["machine", "Equipo industrial"],
];
const HUE = {
  crane: "from-amber-400/30 via-orange-300/10", knuckle: "from-sky-400/30 via-cyan-300/10", forklift: "from-yellow-400/30 via-amber-200/10",
  loader: "from-yellow-500/30 via-orange-200/10", bucket: "from-emerald-400/25 via-teal-200/10", pickup: "from-indigo-400/25 via-sky-200/10",
  truck: "from-slate-400/25 via-slate-200/10", tanker: "from-cyan-400/25 via-blue-200/10", machine: "from-violet-400/25 via-fuchsia-200/10",
};

let FAMILIES = {};
export const setFamilies = (list) => {
  FAMILIES = Object.fromEntries((list || []).map((f) => [f.code, { label: f.name, art: f.art }]));
};
// Carga las familias una vez por minuto como mucho y re-renderiza al llegar.
let familiesLoadedAt = 0;
export const useFamilies = () => {
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (Date.now() - familiesLoadedAt < 60000) return;
    familiesLoadedAt = Date.now();
    fleetService.catalogo().then((c) => { setFamilies(c?.familias); setVersion((v) => v + 1); }).catch(() => {});
  }, []);
};
const famOf = (cat) => FAMILIES[cat] || CATEGORIES[cat];
export const isNamedFamily = (cat) => !!famOf(cat);

export const categoryOf = (code) => {
  const m = String(code || "").toUpperCase().match(/^FP-?([A-Z]+)/);
  return m ? m[1] : "OTRO";
};
export const categoryLabel = (cat) => famOf(cat)?.label || (cat && cat !== "OTRO" ? `Familia ${cat}` : "Otro equipo");
const artOf = (cat, fleetType, art) => art || famOf(cat)?.art || (fleetType === "LIVIANA" ? "pickup" : "truck");
const hueOf = (cat, art) => HUE[artOf(cat, null, art)] || HUE.truck;

const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
const Wheel = ({ cx, cy, r = 6 }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill="currentColor" fillOpacity="0.15" />
    <circle cx={cx} cy={cy} r={r * 0.35} />
  </g>
);

const ART = {
  crane: (
    <g {...common}>
      <path d="M14 62h78v6H14z" /><path d="M58 62V46h22l8 10v6" /><path d="M64 46v-8h12" />
      <path d="M40 50L88 14" strokeWidth="3" /><path d="M84 17v20" strokeDasharray="2 3" /><path d="M81 37h6l-3 5z" />
      <path d="M34 62V52h14v10" /><Wheel cx={26} cy={70} /><Wheel cx={44} cy={70} /><Wheel cx={78} cy={70} />
    </g>
  ),
  knuckle: (
    <g {...common}>
      <path d="M10 60h60v6H10z" /><path d="M70 66V44h14l10 12v10z" /><path d="M76 44v10h16" />
      <path d="M22 60V50" /><path d="M22 50l14-24 22 8" strokeWidth="3" /><path d="M58 34v12" strokeDasharray="2 3" />
      <Wheel cx={22} cy={70} /><Wheel cx={40} cy={70} /><Wheel cx={84} cy={70} />
    </g>
  ),
  forklift: (
    <g {...common}>
      <path d="M40 64V38h22l8 14v12z" /><path d="M46 38V22h14v16" /><path d="M32 16v50" strokeWidth="3" />
      <path d="M32 60h-16" strokeWidth="3" /><path d="M32 44h-12" /><path d="M70 52h8v12" />
      <Wheel cx={46} cy={68} r={7} /><Wheel cx={68} cy={68} r={6} />
    </g>
  ),
  loader: (
    <g {...common}>
      <path d="M44 60V40h18l8-14h12v34z" /><path d="M66 26v14" /><path d="M44 48L22 50" strokeWidth="3" />
      <path d="M8 46l14-4 4 16H10z" fill="currentColor" fillOpacity="0.15" /><path d="M82 48h6" />
      <Wheel cx={50} cy={66} r={9} /><Wheel cx={78} cy={66} r={9} />
    </g>
  ),
  bucket: (
    <g {...common}>
      <path d="M12 60h56v6H12z" /><path d="M68 66V44h14l10 12v10z" /><path d="M74 44v10h16" />
      <path d="M28 60V52" /><path d="M28 52L46 24" strokeWidth="3" /><path d="M42 12h14v12H42z" fill="currentColor" fillOpacity="0.15" />
      <Wheel cx={24} cy={70} /><Wheel cx={42} cy={70} /><Wheel cx={82} cy={70} />
    </g>
  ),
  pickup: (
    <g {...common}>
      <path d="M8 60v-8a3 3 0 0 1 3-3h30l8-12h20l10 12h7a3 3 0 0 1 3 3v8" /><path d="M49 37v12h30" /><path d="M8 60h82" />
      <Wheel cx={24} cy={62} r={8} /><Wheel cx={74} cy={62} r={8} /><path d="M12 49v-4h26" opacity="0.4" />
    </g>
  ),
  tanker: (
    <g {...common}>
      <path d="M60 36h14l12 14v12H60z" /><path d="M66 36v14h20" /><rect x="8" y="30" width="50" height="24" rx="12" fill="currentColor" fillOpacity="0.12" />
      <path d="M8 62h86" /><path d="M22 30v-4h10v4" /><Wheel cx={20} cy={66} /><Wheel cx={36} cy={66} /><Wheel cx={78} cy={66} />
    </g>
  ),
  machine: (
    <g {...common}>
      <rect x="14" y="24" width="64" height="34" rx="4" fill="currentColor" fillOpacity="0.1" />
      <path d="M22 32h14v18H22z" /><path d="M44 32h26M44 38h26M44 44h26M44 50h26" opacity="0.5" />
      <path d="M78 34h8l4 6v12h-12" /><path d="M14 58l-6 8h84l-6-8" /><path d="M30 24v-6h8v6" />
    </g>
  ),
  truck: (
    <g {...common}>
      <path d="M8 62V26a3 3 0 0 1 3-3h46a3 3 0 0 1 3 3v36" /><path d="M60 36h16l12 14v12" /><path d="M66 36v14h22" />
      <path d="M8 62h86" /><Wheel cx={22} cy={66} /><Wheel cx={40} cy={66} /><Wheel cx={78} cy={66} />
      <path d="M16 34h34M16 44h34" opacity="0.35" />
    </g>
  ),
};

// Los svg van dentro de un <span>: AuthLayout.css tiene una regla global
// ".relative > svg { position: absolute }" que los desacomoda si son hijos
// directos de un contenedor "relative".

/** Ilustracion de la familia sobre un degradado (cuando el modelo no tiene foto). */
export const EquipmentArt = ({ category, fleetType, art, className = "", iconClass = "w-2/3" }) => (
  <div className={`relative flex items-center justify-center bg-gradient-to-br ${hueOf(category, art)} to-transparent bg-slate-100 dark:bg-white/[0.04] overflow-hidden ${className}`}>
    <div className="absolute inset-0 opacity-[0.07] dark:opacity-[0.1]" style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
    <span className={`relative flex justify-center text-brand-navy/70 dark:text-sky-200/70 ${iconClass}`}>
      <span className="block w-full"><svg viewBox="0 0 100 80" className="w-full h-auto">{ART[artOf(category, fleetType, art)]}</svg></span>
    </span>
  </div>
);

/** Icono pequeno de la familia (para chips). */
export const CategoryGlyph = ({ category, fleetType, art, className = "w-6 h-5" }) => (
  <span className="inline-flex shrink-0"><svg viewBox="0 0 100 80" className={className}>{ART[artOf(category, fleetType, art)]}</svg></span>
);
