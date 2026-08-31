import { useState } from "react";
import {
  ShieldCheck,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Fuel,
} from "lucide-react";
import { useAuth } from "@/context";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const SidebarItem = ({
  icon: Icon,
  label,
  active,
  onClick,
  children,
  isExpanded,
  setExpanded,
  url, 
}) => {
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const hasChildren = children && children.length > 0;

  const handleClick = () => {
    if (hasChildren) {
      if (!isExpanded) {
        setExpanded(true);
        setIsSubmenuOpen(true);
      } else {
        setIsSubmenuOpen(!isSubmenuOpen);
      }
    } else {
      onClick?.(url);
    }
  };

  return (
    <div className="flex flex-col w-full relative">
      <div
        onClick={handleClick}
        title={!isExpanded ? label : undefined}
        className={`relative flex items-center h-12 mx-3 cursor-pointer transition-colors duration-200 group z-10
          ${
            active
              ? "text-blue-600 dark:text-white"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
      >
        {active && (
          <motion.div
            layoutId="leftIndicator"
            className="absolute -left-[2px] top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-md z-20"
          />
        )}

        {active && (
          <motion.div
            layoutId="activeSidebarTab"
            className="absolute inset-0 bg-blue-50 dark:bg-white/10 rounded-md z-0"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}

        <div className="w-12 h-12 flex items-center justify-center shrink-0 relative z-20">
          <Icon size={22} strokeWidth={active ? 2.5 : 2} />
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="overflow-hidden flex-1 relative z-10"
            >
              <div className="w-[170px] flex items-center justify-between h-12 pr-2">
                <span className="font-semibold text-sm tracking-wide truncate">
                  {label}
                </span>
                {hasChildren && (
                  <ChevronDown
                    size={16}
                    className={`shrink-0 transition-transform duration-300 ${isSubmenuOpen ? "rotate-180" : ""}`}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isExpanded && isSubmenuOpen && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-1 px-3 mt-1 overflow-hidden"
          >
            {children.map((child, idx) => (
              <div
                key={idx}
                onClick={() => onClick?.(child.url)}
                className="flex items-center h-10 pl-12 rounded-md text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition-all"
              >
                <span className="text-sm font-medium">{child.title}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuConfig = [
    {
      icon: ShieldCheck,
      label: "Seguridad",
      children: [
        { title: "Personas", url: "/security/persons" },
        { title: "Usuarios", url: "/security/users" },
        { title: "Perfiles", url: "/security/profiles" },
      ],
    },
    {
      icon: Fuel,
      label: "Combustible",
      children: [
        { title: "Liviana", url: "/fuel" },
        { title: "Pesada", url: "/fuel/heavy" },
        { title: "Unidades", url: "/fuel/vehicles" },
      ],
    },
    { icon: BarChart3, label: "Reportes", url: "/reports" },
  ];

  const checkActive = (item) => {
    if (item.url)
      return (
        location.pathname === item.url ||
        location.pathname.startsWith(item.url + "/")
      );
    if (item.children)
      return item.children.some(
        (child) =>
          location.pathname === child.url ||
          location.pathname.startsWith(child.url + "/"),
      );
    return location.pathname.includes(item.label.toLowerCase());
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: isExpanded ? 260 : 76 }}
      transition={{ type: "spring", stiffness: 220, damping: 28 }}
      className="fixed left-4 top-4 h-[calc(100vh-32px)] rounded-3xl bg-white dark:bg-[#111216] border border-slate-200 dark:border-white/5 z-50 flex flex-col justify-between py-6 shadow-2xl overflow-hidden"
    >
      <div className="flex flex-col gap-6 w-full">
        <div className="px-3">
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="relative flex items-center bg-slate-100 dark:bg-white/5 rounded-2xl h-14 cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 transition-colors group"
          >
            <AnimatePresence>
              {isExpanded && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -5 }}
                  transition={{ duration: 0.2 }}
                  className="absolute left-4 text-sm font-bold text-slate-800 dark:text-white uppercase tracking-widest"
                >
                  Tablero
                </motion.span>
              )}
            </AnimatePresence>

            <motion.div
              layout
              transition={{ type: "spring", stiffness: 220, damping: 28 }}
              className={`flex items-center justify-center w-12 h-12 ${
                isExpanded ? "ml-auto mr-1" : "mx-auto"
              }`}
            >
              <motion.div
                key={isExpanded ? "open" : "closed"}
                initial={{ rotate: -180, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 180, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {isExpanded ? (
                  <X size={20} className="text-slate-500 dark:text-slate-400" />
                ) : (
                  <Menu
                    size={22}
                    className="text-slate-500 dark:text-slate-400 group-hover:text-blue-600"
                  />
                )}
              </motion.div>
            </motion.div>
          </div>
        </div>

        <nav className="flex flex-col gap-2 w-full mt-2">
          {menuConfig.map((item, index) => (
            <SidebarItem
              key={index}
              {...item}
              onClick={(url) => {
                const targetPath = url || `/${item.label.toLowerCase()}`;
                navigate(targetPath);
              }}
              active={checkActive(item)}
              isExpanded={isExpanded}
              setExpanded={setIsExpanded}
            />
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-2 w-full mb-2">
        <div className="h-[1px] bg-slate-200 dark:bg-white/5 w-full mb-2" />
        <SidebarItem
          icon={Settings}
          label="Configuración"
          url="/settings"
          isExpanded={isExpanded}
          setExpanded={setIsExpanded}
          onClick={(url) => navigate(url)}
        />
        <SidebarItem
          icon={LogOut}
          label="Cerrar Sesión"
          isExpanded={isExpanded}
          setExpanded={setIsExpanded}
          onClick={() => logout(navigate)}
        />
      </div>
    </motion.aside>
  );
};