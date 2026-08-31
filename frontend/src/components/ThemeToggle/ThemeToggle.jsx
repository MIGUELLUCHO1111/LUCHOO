import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context";
import { motion } from "framer-motion";

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={toggleTheme}
      className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
    >
      {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
    </motion.button>
  );
};
