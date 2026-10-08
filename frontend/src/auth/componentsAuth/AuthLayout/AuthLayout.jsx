import { useState } from "react";
import { SESSION_END_REASON_KEY } from "@/services/api";

// Por qué se cerró la sesión anterior (cierre por inactividad, 08/10/2026).
const END_REASONS = {
  idle: "Tu sesión se cerró por inactividad. Vuelve a iniciar sesión para continuar.",
  expired: "Tu sesión expiró. Vuelve a iniciar sesión para continuar.",
};
const readEndReason = () => {
  try {
    const reason = sessionStorage.getItem(SESSION_END_REASON_KEY);
    sessionStorage.removeItem(SESSION_END_REASON_KEY);
    return END_REASONS[reason] || null;
  } catch {
    return null;
  }
};
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { User, Lock, Eye, EyeOff } from "lucide-react";

import { useAuth } from "@/context";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NotificationToast } from "@/components";
import { loginSchema } from "@/auth/schemasAuth";

import "./AuthLayout.css";

export const AuthLayout = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "" });
  const [endReason] = useState(readEndReason);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    setLoadingLocal(true);
    try {
      const result = await login(data);
      setToast({
        message: `Bienvenido, ${result.user.username}`,
        type: "success",
      });
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err) {
      setToast({ message: err.message, type: "error" });
    } finally {
      setLoadingLocal(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <>
      <NotificationToast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "" })}
      />
      <motion.div
        className="auth-container w-full max-w-[380px] rounded-[22px] p-7 shadow-xl border border-white/5 bg-white/80 dark:bg-black/40 backdrop-blur-xl"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {endReason && (
          <div
            role="status"
            className="mb-4 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300 text-xs font-medium"
          >
            {endReason}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldSet>
            <motion.div className="text-center mb-6" variants={itemVariants}>
              <h1 className="font-display text-2xl tracking-tight">
                Inicio de Sesión
              </h1>
            </motion.div>
            <FieldGroup className="space-y-3">
              <motion.div variants={itemVariants}>
                <Field>
                  <FieldLabel
                    htmlFor="username"
                    className="text-xs font-semibold mb-1 block opacity-90"
                  >
                    Usuario
                  </FieldLabel>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10 pointer-events-none" />
                    <Input
                      id="username"
                      className={`auth-input pl-9 h-9 text-sm rounded-lg ${errors.username ? "border-red-500" : ""}`}
                      placeholder="Ingresa tu usuario"
                      {...register("username")}
                    />
                  </div>
                  {errors.username && (
                    <p className="text-[10px] text-red-500 mt-1 ml-1 font-medium">
                      {errors.username.message}
                    </p>
                  )}
                </Field>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Field>
                  <div className="flex items-center justify-between mb-1">
                    <FieldLabel
                      htmlFor="password"
                      className="text-xs font-semibold opacity-90"
                    >
                      Contraseña
                    </FieldLabel>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10 pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      className={`auth-input pl-9 pr-9 h-9 text-sm rounded-lg ${errors.password ? "border-red-500" : ""}`}
                      placeholder="Ingresa tu contraseña"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none z-10"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-[10px] text-red-500 mt-1 ml-1 font-medium">
                      {errors.password.message}
                    </p>
                  )}
                </Field>
              </motion.div>
            </FieldGroup>
          </FieldSet>
          <motion.div className="mt-6" variants={itemVariants}>
            <Button
              type="submit"
              disabled={loadingLocal}
              className="auth-submit-btn w-full h-10 rounded-lg font-bold text-white uppercase tracking-wider text-[11px] cursor-pointer shadow-md"
            >
              {loadingLocal ? "Validando..." : "Iniciar Sesión"}
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </>
  );
};
