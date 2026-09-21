import { useAuth } from "@/context";
import { motion } from "framer-motion";
import { User, LayoutDashboard } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white/80 dark:bg-[#0f1115]/80 backdrop-blur-md p-8 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-sm transition-all duration-300 hover:border-brand-navy/30">
            <h3 className="text-xs font-black uppercase text-brand-navy mb-3 tracking-widest">
              Estado
            </h3>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              Sesión Activa
            </p>
          </div>

          <div className="bg-white/80 dark:bg-[#0f1115]/80 backdrop-blur-md p-8 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-center transition-all duration-300 hover:border-brand-navy/30">
            <LayoutDashboard size={48} className="text-brand-navy/20" />
          </div>
        </div>
      </motion.div>
    </PageLayout>
  );
};
