import { z } from "zod";
import { SecurityRules } from "@/service/securityService";

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, "El usuario es obligatorio")
    .refine((val) => SecurityRules.isSafe(val) === true, {
      message: "Entrada no válida o insegura",
    }),

  password: z
    .string()
    .min(1, "La contraseña es obligatoria")
    .refine((val) => SecurityRules.isSafe(val) === true, {
      message: "Contraseña con patrones no permitidos",
    }),
});