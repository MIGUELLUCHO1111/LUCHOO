import { useState } from "react";
import { Lock, Sun, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { AuthForm } from "../AuthForm/AuthForm";
import { AlertMessage } from "@/components";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context";
import { resetPasswordSchema } from "@/auth/schemasAuth/ForgotSchema/ForgotSchema";


import LogoLight from "@/assets/img/fullpetro-white.png";
import LogoDark from "@/assets/img/fullpetro-dark.png";

export const ResetLayout = () => {
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const onSubmit = async (data) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 1500);
  };

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-main)]">
        <AlertMessage 
          type="success"
          title="Â¡Clave Actualizada!"
          message="Tu contraseña ha sido cambiada con éxito. Ya puedes iniciar sesión."
          buttonText="Ir al Login"
          onConfirm={() => navigate("/login")}
        />
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden transition-colors duration-500"
      style={{
        background:
          theme === "light"
            ? `radial-gradient(at bottom right, rgba(37, 99, 235, 0.15) 0%, transparent 50%),
               linear-gradient(to bottom, #ffffff 70%, #dbeafe 100%)`
            : `radial-gradient(at bottom right, rgba(30, 58, 138, 0.3) 0%, transparent 50%),
               linear-gradient(to bottom, #000000 70%, #0a0a2e 100%)`,
      }}
    >
      <div className="fixed top-8 left-8 right-8 flex justify-between items-center z-50">
        <img
          src={theme === "light" ? LogoLight : LogoDark}
          alt="Logo Fullpetro"
          className="h-10 w-auto object-contain"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full h-10 w-10 bg-white/5 backdrop-blur-sm"
        >
          {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
        </Button>
      </div>

    
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
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-md px-6 flex justify-center"
      >
        <AuthForm 
          title="Nueva Contraseña"
          subtitle="Define tu nueva clave de acceso para Fullpetro"
          schema={resetPasswordSchema}
          fields={[
            { name: "password", label: "Contraseña", type: "password", placeholder: "••••••", icon: <Lock size={14}/> },
            { name: "confirmPassword", label: "Confirmar", type: "password", placeholder: "••••••", icon: <Lock size={14}/> }
          ]}
          onSubmit={onSubmit}
          submitText="Restablecer"
          isLoading={loading}
        />
      </motion.div>
    </div>
  );
};