import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio").max(150),
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  role: z.enum(["ADMIN", "AGENT", "REQUESTER"]),
  department: z.string().max(100).optional().nullable(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  role: z.enum(["ADMIN", "AGENT", "REQUESTER"]).optional(),
  department: z.string().max(100).optional().nullable(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  AGENT: "Agente de soporte",
  REQUESTER: "Solicitante",
};
