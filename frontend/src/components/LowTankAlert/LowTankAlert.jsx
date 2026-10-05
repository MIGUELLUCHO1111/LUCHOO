import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Fuel, X } from "lucide-react";
import { useAuth } from "@/context";
import { fuelService } from "@/services";
import {
  LOW_TANK_PERCENT,
  TANKS_CHANGED_EVENT,
  isTankLow,
  tankPercent,
} from "@/lib/tankAlert";

const TANK_ROUTE = "/fuel/tank";
const POLL_MS = 5 * 60 * 1000;
const DISMISS_KEY = "lowTankAlert:dismissed";

// Tanques que el usuario ya cerró en esta sesión. Si el tanque se llena y
// vuelve a bajar del umbral, se saca de la lista para que avise de nuevo.
const readDismissed = () => {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
};

const writeDismissed = (ids) => {
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
  } catch {
    // sin sessionStorage la alerta simplemente reaparece al recargar
  }
};

/**
 * Notificación global (esquina inferior derecha) cuando algún tanque de
 * combustible activo baja al 25% de su capacidad o menos. Solo se muestra a
 * perfiles con acceso a la sección de Tanque, y no dentro de esa misma página
 * (ahí se ve el aviso propio de la página).
 */
export const LowTankAlert = () => {
  const { user, allowedSections } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [lowTanks, setLowTanks] = useState([]);
  const [dismissed, setDismissed] = useState(readDismissed);

  const canSeeTanks = !!user && Array.isArray(allowedSections) && allowedSections.includes(TANK_ROUTE);

  const refresh = useCallback(() => {
    fuelService
      .getAllTanks()
      .then((res) => {
        const low = (Array.isArray(res) ? res : []).filter((t) => t.is_active && isTankLow(t));
        setLowTanks(low);
        setDismissed((prev) => {
          const lowIds = new Set(low.map((t) => t.id));
          const next = prev.filter((id) => lowIds.has(id));
          if (next.length !== prev.length) writeDismissed(next);
          return next;
        });
      })
      .catch(() => {
        // sin permiso o sin red: no se notifica
      });
  }, []);

  useEffect(() => {
    if (!canSeeTanks) return;
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    window.addEventListener(TANKS_CHANGED_EVENT, refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener(TANKS_CHANGED_EVENT, refresh);
    };
  }, [canSeeTanks, refresh]);

  const visible = lowTanks.filter((t) => !dismissed.includes(t.id));
  const show = canSeeTanks && location.pathname !== TANK_ROUTE && visible.length > 0;

  const dismiss = () => {
    const next = [...new Set([...dismissed, ...visible.map((t) => t.id)])];
    setDismissed(next);
    writeDismissed(next);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
          role="alert"
          className="fixed bottom-4 right-4 z-[90] w-[calc(100%-2rem)] max-w-sm p-4 rounded-2xl shadow-lg border backdrop-blur-md bg-amber-50/95 border-amber-300 text-amber-900 dark:bg-amber-950/70 dark:border-amber-700 dark:text-amber-100"
        >
          <button
            onClick={dismiss}
            className="absolute right-2 top-2 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4 opacity-60" />
          </button>

          <div className="flex items-start gap-3 pr-5">
            <div className="flex-shrink-0 p-2 rounded-xl bg-amber-500/15">
              <Fuel className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest mb-1">
                Tanque por llenar
              </p>
              <p className="text-xs opacity-90 mb-2">
                El nivel está bajando (≤ {LOW_TANK_PERCENT}% de su capacidad) y debe ser llenado.
              </p>
              <ul className="text-xs font-medium space-y-0.5 mb-3">
                {visible.map((t) => (
                  <li key={t.id} className="truncate">
                    <span className="font-mono font-bold">{t.code}</span> · {Math.round(tankPercent(t))}%
                    {" "}({Math.round(t.current_level_liters)} / {Math.round(t.capacity_liters)} L)
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate(TANK_ROUTE)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
              >
                Ver tanque
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
