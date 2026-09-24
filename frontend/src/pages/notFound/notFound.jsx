import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { useTheme } from "@/context";
import { Button } from "@/components/ui/button";
import { AlertMessage } from "@/components";

import LogoLight from "../../assets/img/fullpetro-white.png";
import LogoDark from "../../assets/img/fullpetro-dark.png";

export const NotFound = () => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden transition-colors duration-500"
      style={{
        background:
          theme === "light"
            ? `radial-gradient(at bottom right, rgba(37, 99, 235, 0.15) 0%, transparent 50%),
               radial-gradient(at bottom left, rgba(29, 78, 216, 0.1) 0%, transparent 40%),
               linear-gradient(to bottom, #ffffff 70%, #dbeafe 100%)`
            : `radial-gradient(at bottom right, rgba(30, 58, 138, 0.3) 0%, transparent 50%),
               radial-gradient(at bottom left, rgba(22, 20, 56, 0.4) 0%, transparent 40%),
               linear-gradient(to bottom, #000000 70%, #0a0a2e 100%)`,
      }}
    >
      <div className="fixed top-8 left-8 right-8 flex justify-between items-center z-50">
        <motion.div
          key={theme}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center"
        >
          <img
            src={theme === "light" ? LogoLight : LogoDark}
            alt="Logo Fullpetro"
            className="h-10 w-auto object-contain filter drop-shadow-sm"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex items-center"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full h-10 w-10 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-primary)] backdrop-blur-sm bg-white/5"
          >
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
          </Button>
        </motion.div>
      </div>

      <motion.div
        className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-gradient-to-br from-brand-navy/20 dark:from-brand-navy-light/10 to-transparent rounded-full blur-[120px]"
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-gradient-to-tl from-brand-gold/20 dark:from-brand-gold-dark/10 to-transparent rounded-full blur-[120px]"
        animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <div
        className="absolute inset-0 z-0 opacity-[0.4] dark:opacity-[0.2]"
        style={{
          backgroundImage: `linear-gradient(var(--grid-color) 1px, transparent 1px), 
                            linear-gradient(90deg, var(--grid-color) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full flex justify-center px-6"
      >
        <AlertMessage
          title="Error 404"
          message="La página que estás buscando no existe o ha sido movida. Verifica la dirección e intenta de nuevo."
          buttonText="Ir al inicio de sesión"
          onConfirm={() => navigate("/login")}
          type="error"
        />
      </motion.div>
    </div>
  );
};
