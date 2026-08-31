import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export const NotificationToast = ({
  message,
  type,
  onClose,
  duration = 3000,
}) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, onClose, duration]);

  const toastStyles =
    type === "error"
      ? "bg-red-50/95 border-red-200 text-red-900 dark:bg-red-950/60 dark:border-red-800 dark:text-red-200"
      : "bg-green-50/95 border-green-200 text-green-900 dark:bg-green-950/60 dark:border-green-800 dark:text-green-200";

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
          className={`fixed bottom-4 right-4 z-[100] flex items-center p-3 rounded-xl shadow-lg border backdrop-blur-md ${toastStyles}`}
          style={{ minWidth: "260px", maxWidth: "340px" }}
        >
          <div className="flex-shrink-0">
            {type === "error" ? (
              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-400" />
            )}
          </div>
          <div className="ml-2.5 mr-6">
            <p className="text-[10px] font-bold uppercase tracking-widest leading-none mb-0.5">
              {type === "error" ? "Error" : "Éxito"}
            </p>
            <p className="text-[11px] font-medium opacity-90 leading-tight">
              {message}
            </p>
          </div>

          <button
            onClick={onClose}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all 
                       hover:bg-black/5 dark:hover:bg-white/10 group cursor-pointer"
          >
            <X className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
