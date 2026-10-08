import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Clock } from "lucide-react";
import { useAuth } from "@/context";
import api, { getLastServerContact, SESSION_END_REASON_KEY } from "@/services/api";

// Cierre de sesión por INACTIVIDAD (pedido de Julio, 08/10/2026).
//
// - Cuenta como actividad: mover el mouse, hacer clic, escribir, desplazarse
//   o tocar la pantalla. La última actividad se comparte entre pestañas
//   (localStorage), así trabajar en una pestaña mantiene viva la sesión en
//   todas.
// - A los N minutos sin actividad (los define el servidor,
//   SESSION_IDLE_MINUTES, 30 por defecto) cierra la sesión y el login lo
//   explica. Un minuto antes avisa, con un botón para seguir conectado.
// - Si la persona está activa pero sin pedir nada al servidor (leyendo una
//   página), cada 5 minutos se hace una consulta liviana para que el servidor
//   le renueve el pase; si no, lo sacaría aunque estuviera usando la app.
const ACTIVITY_KEY = "last_activity";
const EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "wheel", "touchstart"];
const CHECK_MS = 15_000;
const WARN_MS = 60_000;
const KEEPALIVE_MS = 5 * 60_000;

const idleMs = () => {
  const n = Number.parseInt(localStorage.getItem("session_idle_minutes"), 10);
  return (Number.isFinite(n) && n > 0 ? n : 30) * 60_000;
};

const readShared = () => {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
};

export const IdleSessionGuard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const lastActivity = useRef(0); // se inicializa en el efecto (markActive)
  const lastSharedWrite = useRef(0);
  const [secondsLeft, setSecondsLeft] = useState(null);

  const markActive = useCallback(() => {
    const now = Date.now();
    lastActivity.current = now;
    // Escribir en localStorage como mucho cada 5 s (mousemove dispara mucho).
    if (now - lastSharedWrite.current > 5000) {
      lastSharedWrite.current = now;
      try {
        localStorage.setItem(ACTIVITY_KEY, String(now));
      } catch {
        // sin localStorage, cada pestaña cuenta por su cuenta
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    markActive();
    EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    const timer = setInterval(() => {
      const now = Date.now();
      const last = Math.max(lastActivity.current, readShared());
      const remaining = idleMs() - (now - last);

      if (remaining <= 0) {
        clearInterval(timer);
        sessionStorage.setItem(SESSION_END_REASON_KEY, "idle");
        logout(navigate, "idle");
        return;
      }
      setSecondsLeft(remaining <= WARN_MS ? Math.ceil(remaining / 1000) : null);

      // Activo hace poco pero sin hablar con el servidor: renovar el pase.
      if (now - last < CHECK_MS * 2 && now - getLastServerContact() > KEEPALIVE_MS) {
        api.get("/user/me").catch(() => {});
      }
    }, CHECK_MS);

    // Si en otra pestaña se cerró la sesión, esta también va al login.
    const onStorage = (e) => {
      if (e.key === "token" && !e.newValue) navigate("/login", { replace: true });
    };
    window.addEventListener("storage", onStorage);

    return () => {
      clearInterval(timer);
      EVENTS.forEach((e) => window.removeEventListener(e, markActive));
      window.removeEventListener("storage", onStorage);
    };
  }, [user, logout, navigate, markActive]);

  // Mientras se muestra el aviso, el contador baja cada segundo.
  useEffect(() => {
    if (secondsLeft === null) return;
    const t = setTimeout(() => {
      const last = Math.max(lastActivity.current, readShared());
      const remaining = idleMs() - (Date.now() - last);
      setSecondsLeft(remaining > 0 && remaining <= WARN_MS ? Math.ceil(remaining / 1000) : null);
    }, 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const stayConnected = () => {
    lastSharedWrite.current = 0;
    markActive();
    setSecondsLeft(null);
    api.get("/user/me").catch(() => {});
  };

  return (
    <AnimatePresence>
      {user && secondsLeft !== null && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          role="alertdialog"
          aria-live="assertive"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-2rem)] max-w-md p-4 rounded-2xl shadow-xl border bg-white dark:bg-[#15181e] border-amber-300 dark:border-amber-500/40 flex items-center gap-3"
        >
          <span className="inline-flex shrink-0 p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Clock size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Tu sesión se cerrará por inactividad</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              en {secondsLeft} s. Lo que no hayas guardado se perderá.
            </p>
          </div>
          <button
            onClick={stayConnected}
            className="shrink-0 px-3 py-2 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold cursor-pointer"
          >
            Seguir conectado
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
