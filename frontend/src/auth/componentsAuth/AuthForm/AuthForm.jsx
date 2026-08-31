import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion"; // Usamos motion para evitar el error de ESLint
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const AuthForm = ({ title, subtitle, schema, fields, onSubmit, submitText, isLoading, footer }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <motion.div
      className="auth-container w-full max-w-[360px] rounded-[22px] p-7 shadow-xl border border-white/5 bg-white/80 dark:bg-black/40 backdrop-blur-xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-[11px] mt-1 font-medium opacity-80">{subtitle}</p>}
        </div>

        <FieldGroup className="space-y-4">
          {fields.map((f) => (
            <div key={f.name}>
              <Field>
                <FieldLabel htmlFor={f.name} className="text-xs font-semibold mb-1 block opacity-90">
                  {f.label}
                </FieldLabel>
                <div className="relative group">
                  {f.icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10">{f.icon}</div>}
                  <Input
                    id={f.name}
                    type={f.type || "text"}
                    className={`auth-input ${f.icon ? 'pl-9' : 'px-4'} h-10 text-sm rounded-lg ${errors[f.name] ? "border-red-500" : ""}`}
                    placeholder={f.placeholder}
                    {...register(f.name)}
                  />
                </div>
                <AnimatePresence>
                  {errors[f.name] && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-red-500 mt-1 ml-1 font-medium">
                      {errors[f.name].message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </Field>
            </div>
          ))}
        </FieldGroup>

        <div className="mt-6">
          <Button type="submit" disabled={isLoading} className="auth-submit-btn w-full h-10 rounded-lg font-bold text-white uppercase tracking-wider text-[11px] shadow-md cursor-pointer">
            {isLoading ? "Procesando..." : submitText}
          </Button>
          {footer}
        </div>
      </form>
    </motion.div>
  );
};