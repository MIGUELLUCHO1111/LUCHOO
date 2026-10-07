import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { resolveFleetFileUrl } from "@/services";

// Conductor de la unidad en Tracker (07/10/2026): foto y nombre del registro
// de Conductores de Flota. Si el conductor esta registrado, al tocarlo abre su
// ficha; si no, se muestra el texto suelto de la unidad (ej. ROTATIVO).
// Espera { driver_id, driver_full_name, driver_photo_url, driver_name }.
const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export default function DriverChip({ s, size = "sm" }) {
  const navigate = useNavigate();
  const [imgOk, setImgOk] = useState(true);
  if (!s?.driver_id) return <span>{s?.driver_name || "-"}</span>;
  const big = size === "md";
  const box = big ? "h-9 w-9 text-xs" : "h-7 w-7 text-[10px]";
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/fleet/drivers/${s.driver_id}`); }} title="Abrir la ficha del conductor"
      className="group inline-flex items-center gap-2 max-w-full text-left">
      <span className={`${box} rounded-lg overflow-hidden shrink-0 bg-brand-navy text-white font-black flex items-center justify-center ring-2 ring-white dark:ring-[#0f1115] shadow-sm`}>
        {s.driver_photo_url && imgOk
          ? <img src={resolveFleetFileUrl(s.driver_photo_url)} alt={s.driver_full_name} className="h-full w-full object-cover" onError={() => setImgOk(false)} />
          : initials(s.driver_full_name)}
      </span>
      <span className="min-w-0">
        <span className={`block truncate font-bold text-brand-navy dark:text-sky-200 group-hover:underline ${big ? "text-sm" : "text-xs"}`}>{s.driver_full_name}</span>
        {big && s.driver_phone && <span className="block text-[11px] text-slate-500">{s.driver_phone}</span>}
      </span>
    </button>
  );
}
