import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowLeft } from "lucide-react";

import { useAuth } from "@/context";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertMessage } from "@/components";

import { forgotSchema } from "@/auth/schemasAuth";

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

export const ForgotLayout = () => {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { forgotPassword } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await forgotPassword({ email: data.email });
      setSent(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6">
        <AlertMessage
          type="success"
          title="¡Revisa tu correo!"
          message="Si el correo existe, te enviamos un enlace para restablecer tu contraseña."
          buttonText="Volver al inicio de sesión"
          onConfirm={() => navigate("/login")}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full min-h-[80vh] p-6">
      <motion.div
        className="auth-container w-full max-w-[380px] rounded-[22px] p-7 shadow-xl border border-white/5 bg-white/80 dark:bg-black/40 backdrop-blur-xl"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldSet>
            <motion.div className="text-center mb-6" variants={itemVariants}>
              <h1 className="text-2xl font-extrabold tracking-tight">
                Recuperar Acceso
              </h1>
              <p className="text-muted-foreground text-[11px] mt-1 font-medium opacity-70">
                Enviaremos un enlace a tu correo
              </p>
            </motion.div>

            <FieldGroup className="space-y-3">
              <motion.div variants={itemVariants}>
                <Field>
                  <FieldLabel
                    htmlFor="email"
                    className="text-xs font-semibold mb-1 block opacity-90"
                  >
                    Correo electrónico
                  </FieldLabel>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10 pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      className={`auth-input pl-9 h-9 text-sm rounded-lg ${errors.email ? "border-red-500" : ""}`}
                      placeholder="Ingresa tu correo"
                      {...register("email")}
                    />
                  </div>
                  <AnimatePresence mode="wait">
                    {errors.email && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-[10px] text-red-500 mt-1 ml-1 font-medium overflow-hidden"
                      >
                        {errors.email.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </Field>
              </motion.div>
            </FieldGroup>
          </FieldSet>

          <motion.div
            className="mt-6 flex flex-col gap-3"
            variants={itemVariants}
          >
            <Button
              type="submit"
              disabled={isSubmitting || loading}
              className="auth-submit-btn w-full h-10 rounded-lg font-bold text-white uppercase tracking-wider text-[11px] cursor-pointer shadow-md"
            >
              {isSubmitting ? "Enviando..." : "Enviar enlace"}
            </Button>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-[10px] h-8 font-semibold text-muted-foreground hover:text-blue-500 transition-all flex items-center justify-center gap-2 group cursor-pointer bg-transparent border-none"
            >
              <ArrowLeft
                size={14}
                className="group-hover:-translate-x-1 transition-transform"
              />
              Volver al Login
            </button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
};
