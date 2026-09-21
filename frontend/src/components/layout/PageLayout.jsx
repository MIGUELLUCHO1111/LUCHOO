import { useNavigate } from "react-router-dom";
import { LogOut, Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth, useTheme } from "@/context";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/Sidebar/Sidebar";

import logoDark from "@/assets/img/fullpetro-dark.png";
import logoWhite from "@/assets/img/fullpetro-white.png";

// Clases completas y literales a propósito (nunca `bg-${accentColor}-500/10`
// interpolado): el scanner de Tailwind solo genera una utilidad si ve el
// nombre completo tal cual escrito en el código fuente -- una clase armada
// por interpolación de string nunca matchea, así que el blob decorativo
// llevaba tiempo sin poder mostrarse en ninguna página (bug real, no solo
// de marca). accentColor ahora es una llave a esta tabla, no un color de
// Tailwind libre.
const ACCENT_BLOB = {
  navy: "bg-brand-navy/10",
  gold: "bg-brand-gold/20",
};

export const PageLayout = ({
  icon: Icon,
  title,
  subtitle,
  iconGradient = "from-brand-navy to-brand-navy-light",
  iconShadow = "shadow-brand-navy/30",
  maxWidth = "max-w-7xl",
  accentColor = "navy",
  children,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => logout(navigate);

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-[#0a0a0c] transition-colors duration-500 relative overflow-hidden font-sans">
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(${theme === "dark" ? "#ffffff" : "#000000"} 1px, transparent 1px), linear-gradient(90deg, ${theme === "dark" ? "#ffffff" : "#000000"} 1px, transparent 1px)`,
          backgroundSize: "45px 45px",
        }}
      />

      {/* z-[5]: por debajo del contenido (z-10, botones de Salir/tema
          incluidos) para que el logo nunca los tape -- antes estaba en
          z-50, por encima de todo, y el logo terminaba dibujado sobre los
          botones del encabezado en vez de detrás. Sigue por encima del
          fondo de cuadrícula (z-0). */}
      <div
        style={{ position: "fixed" }}
        className="hidden md:block top-8 right-10 z-[5] pointer-events-none"
      >
        <img
          src={theme === "dark" ? logoDark : logoWhite}
          alt="Fullpetro Logo"
          className="h-36 w-auto object-contain transition-all duration-500"
        />
      </div>

      <Sidebar />

      <div className="flex-1 px-8 pb-8 pt-20 md:pt-8 relative flex flex-col items-center overflow-auto ml-0 md:ml-[76px]">
        <div className={`absolute -top-[10%] -left-[10%] w-[40%] h-[40%] ${ACCENT_BLOB[accentColor] || ACCENT_BLOB.navy} rounded-full blur-[120px] pointer-events-none`} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`relative z-10 w-full ${maxWidth} flex flex-col`}
        >
          <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-5">
              <div className={`h-16 w-16 rounded-[24px] bg-gradient-to-br ${iconGradient} flex items-center justify-center shadow-lg ${iconShadow}`}>
                <Icon size={32} className="text-white" />
              </div>
              <div>
                <h1 className="font-display text-3xl tracking-tight text-slate-900 dark:text-white">
                  {title}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                  {subtitle || `PANEL DE FULLPETRO • ${new Date().toLocaleDateString()}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-8">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleTheme}
                className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1115] h-10 w-10 hover:scale-105 transition-transform"
              >
                {theme === "light" ? (
                  <Moon size={18} />
                ) : (
                  <Sun size={18} className="text-yellow-400" />
                )}
              </Button>

              <Button
                onClick={handleLogout}
                variant="destructive"
                className="rounded-xl font-bold flex items-center gap-2 px-6 h-10 bg-[#ff5f5f] hover:bg-red-600 text-white transition-transform hover:scale-105 text-sm"
              >
                <LogOut size={16} /> Salir
              </Button>
            </div>
          </div>

          {children}
        </motion.div>
      </div>
    </div>
  );
};
