import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const ConfirmContext = createContext(null);

/**
 * Reemplaza el `confirm()` nativo del navegador por un modal propio,
 * siguiendo el mismo lenguaje visual que el modal de detalle de Fuel
 * (overlay + framer-motion + rounded-3xl).
 */
export const ConfirmProvider = ({ children }) => {
  const [request, setRequest] = useState(null);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setRequest({
        title: options.title || "Confirmar acción",
        message,
        confirmText: options.confirmText || "Eliminar",
        cancelText: options.cancelText || "Cancelar",
        danger: options.danger !== false,
        resolve,
      });
    });
  }, []);

  const close = (result) => {
    request?.resolve(result);
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <AnimatePresence>
        {request && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => close(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/5 shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  {request.danger && (
                    <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-500/10 text-red-500 shrink-0">
                      <AlertTriangle size={18} />
                    </span>
                  )}
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {request.title}
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => close(false)}
                  className="rounded-xl shrink-0"
                >
                  <X size={18} />
                </Button>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                {request.message}
              </p>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => close(false)}
                  className="rounded-xl"
                >
                  {request.cancelText}
                </Button>
                <Button
                  type="button"
                  onClick={() => close(true)}
                  className={
                    request.danger
                      ? "rounded-xl bg-red-500 hover:bg-red-600 text-white"
                      : "rounded-xl bg-orange-500 hover:bg-orange-600 text-white"
                  }
                >
                  {request.confirmText}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};

/** `const confirm = useConfirm(); const ok = await confirm("¿Eliminar X?");` */
export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm debe usarse dentro de <ConfirmProvider>");
  }
  return ctx;
};
