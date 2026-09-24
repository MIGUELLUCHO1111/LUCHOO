import { useAuth } from "@/context";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Fuel, Radio, Clock, BarChart3, ArrowRight } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";

// Un acceso directo por sección principal (mismo criterio de visibilidad
// que el Sidebar: allowedSections === null mientras se resuelve el
// perfil no restringe todavía, para evitar un parpadeo de "sin accesos").
const SHORTCUTS = [
  { icon: Fuel, label: "Combustible", description: "Llenados, tanque de gasoil y unidades", url: "/fuel" },
  { icon: Radio, label: "Tracker GPS", description: "Estado de flota, alertas y mapa en vivo", url: "/tracker" },
  { icon: Clock, label: "Control de Horas", description: "Registro diario por proyecto y equipo", url: "/hours" },
  { icon: BarChart3, label: "Reportes", description: "Resumen de combustible y horas trabajadas", url: "/reports" },
];

export const Dashboard = () => {
  const { user, allowedSections } = useAuth();
  const navigate = useNavigate();

  const canSee = (url) => !allowedSections || allowedSections.includes(url);
  const shortcuts = SHORTCUTS.filter((s) => canSee(s.url));

  return (
    <PageLayout
      icon={User}
      title={`Bienvenido, ${user?.username}`}
      subtitle={`PANEL DE FULLPETRO • ${new Date().toLocaleDateString()}`}
      accentColor="navy"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-5xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {shortcuts.map(({ icon: Icon, label, description, url }) => (
            <button
              key={url}
              type="button"
              onClick={() => navigate(url)}
              className="group text-left bg-white/80 dark:bg-[#0f1115]/80 backdrop-blur-md p-8 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-sm transition-all duration-300 hover:border-brand-navy/30 hover:-translate-y-0.5 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-navy to-brand-navy-light flex items-center justify-center shadow-lg shadow-brand-navy/30">
                  <Icon size={22} className="text-white" />
                </div>
                <ArrowRight
                  size={18}
                  className="text-slate-300 dark:text-slate-600 group-hover:text-brand-navy group-hover:translate-x-1 transition-all"
                />
              </div>
              <h3 className="font-display text-lg text-slate-900 dark:text-white mb-1">
                {label}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            </button>
          ))}
        </div>
      </motion.div>
    </PageLayout>
  );
};
