import { useAuth } from "@/context";
import { motion } from "framer-motion";
import { User, LayoutDashboard } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";

// Placeholder a proposito: las dos tarjetas que tenia antes (Estado /
// Usuario ID) no aportaban informacion util. Pendiente definir contenido
// real -- ver conversacion sobre accesos directos vs. KPIs en vivo.
export const Dashboard = () => {
  const { user } = useAuth();

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
        <div className="bg-white/80 dark:bg-[#0f1115]/80 backdrop-blur-md p-12 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-sm flex flex-col items-center justify-center text-center gap-3">
          <LayoutDashboard size={40} className="text-brand-navy/30" />
          <p className="text-slate-400 dark:text-slate-500 text-sm max-w-sm">
            Esta pantalla todavía no tiene contenido definido — usa el menú de la izquierda para ir a Combustible, Tracker GPS, Control de Horas o Reportes.
          </p>
        </div>
      </motion.div>
    </PageLayout>
  );
};
