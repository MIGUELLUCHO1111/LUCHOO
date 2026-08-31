import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, AlertTriangle, XCircle } from "lucide-react";

export const AlertMessage = ({
  title,
  message,
  buttonText,
  onConfirm,
  type = "success",
}) => {
  const config = {
    success: {
      colorClass: "text-green-500 dark:text-green-400",
      bgBlur: "bg-green-500/20",
      btnClass: "bg-green-600 hover:bg-green-700",
      icon: (
        <CheckCircle2 size={56} strokeWidth={1.5} className="relative z-10" />
      ),
    },
    warning: {
      colorClass: "text-amber-500 dark:text-amber-400",
      bgBlur: "bg-amber-500/20",
      btnClass: "bg-amber-600 hover:bg-amber-700",
      icon: (
        <AlertTriangle size={56} strokeWidth={1.5} className="relative z-10" />
      ),
    },
    error: {
      colorClass: "text-red-500 dark:text-red-400",
      bgBlur: "bg-red-500/20",
      btnClass: "bg-red-600 hover:bg-red-700",
      icon: <XCircle size={56} strokeWidth={1.5} className="relative z-10" />,
    },
  };

  const current = config[type] || config.success;

  const iconVariants = {
    hidden: { scale: 0, rotate: -45 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: { type: "spring", stiffness: 200, damping: 15, delay: 0.2 },
    },
  };

  return (
    <motion.div
      className="w-full max-w-[360px] rounded-[16px] p-6 text-center shadow-xl border border-white/5 bg-white/80 dark:bg-black/40 backdrop-blur-xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className={`flex justify-center mb-4 ${current.colorClass}`}
        variants={iconVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="relative h-16 w-16 flex items-center justify-center">
          <div
            className={`absolute inset-0 blur-xl rounded-full scale-125 ${current.bgBlur}`}
          />
          {current.icon}
        </div>
      </motion.div>

      <h1 className="text-xl font-extrabold tracking-tight mb-2 text-slate-900 dark:text-white">
        {title}
      </h1>

      <p className="text-muted-foreground text-[11px] mb-6 px-2 font-medium opacity-80 leading-relaxed">
        {message}
      </p>

      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Button
          onClick={onConfirm}
          className={`${current.btnClass} w-full h-9.5 rounded-lg font-bold text-white uppercase tracking-wider text-[10px] cursor-pointer shadow-md flex items-center justify-center gap-2 group transition-all`}
        >
          {buttonText}
          <ArrowRight
            size={14}
            className="group-hover:translate-x-1 transition-transform"
          />
        </Button>
      </motion.div>
    </motion.div>
  );
};
