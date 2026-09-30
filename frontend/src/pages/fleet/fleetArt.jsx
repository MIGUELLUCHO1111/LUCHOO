// Familias de equipo (prefijo del codigo interno) e ilustraciones para el
// Catalogo de Flota. Solo se nombran las familias confirmadas en
// ROADMAP_FLOTA_DETALLE.md; las demas se muestran como "Familia XX" hasta
// que Operaciones confirme que son.

export const CATEGORIES = {
  GT: { label: "Grúa telescópica", art: "crane", hue: "from-amber-400/30 via-orange-300/10" },
  BA: { label: "Brazo articulado", art: "knuckle", hue: "from-sky-400/30 via-cyan-300/10" },
  MT: { label: "Montacargas", art: "forklift", hue: "from-yellow-400/30 via-amber-200/10" },
  CF: { label: "Cargador frontal", art: "loader", hue: "from-yellow-500/30 via-orange-200/10" },
  CC: { label: "Camión cesta", art: "bucket", hue: "from-emerald-400/25 via-teal-200/10" },
  VEH: { label: "Vehículo", art: "pickup", hue: "from-indigo-400/25 via-sky-200/10" },
  OTRO: { label: "Otro equipo", art: "truck", hue: "from-slate-400/25 via-slate-200/10" },
};

export const categoryOf = (code) => {
  const m = String(code || "").toUpperCase().match(/^FP-?([A-Z]+)/);
  return m ? m[1] : "OTRO";
};
export const categoryLabel = (cat) => CATEGORIES[cat]?.label || (cat && cat !== "OTRO" ? `Familia ${cat}` : "Otro equipo");
const artOf = (cat, fleetType) => CATEGORIES[cat]?.art || (fleetType === "LIVIANA" ? "pickup" : "truck");
const hueOf = (cat) => CATEGORIES[cat]?.hue || "from-slate-400/25 via-slate-200/10";

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
export const EquipmentArt = ({ category, fleetType, className = "", iconClass = "w-2/3" }) => (
  <div className={`relative flex items-center justify-center bg-gradient-to-br ${hueOf(category)} to-transparent bg-slate-100 dark:bg-white/[0.04] overflow-hidden ${className}`}>
    <div className="absolute inset-0 opacity-[0.07] dark:opacity-[0.1]" style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
    <span className={`relative flex justify-center text-brand-navy/70 dark:text-sky-200/70 ${iconClass}`}>
      <span className="block w-full"><svg viewBox="0 0 100 80" className="w-full h-auto">{ART[artOf(category, fleetType)]}</svg></span>
    </span>
  </div>
);

/** Icono pequeno de la familia (para chips). */
export const CategoryGlyph = ({ category, fleetType, className = "w-6 h-5" }) => (
  <span className="inline-flex shrink-0"><svg viewBox="0 0 100 80" className={className}>{ART[artOf(category, fleetType)]}</svg></span>
);
