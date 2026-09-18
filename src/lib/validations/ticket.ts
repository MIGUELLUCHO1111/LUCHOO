import { z } from "zod";

export const createTicketSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres").max(150),
  description: z.string().min(5, "Describe la solicitud con más detalle").max(4000),
  typeId: z.string().min(1, "Selecciona un tipo de solicitud"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  department: z.string().max(100).optional().nullable(),
  assetId: z.string().optional().nullable(),
});

export const updateTicketSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: z.string().nullable().optional(),
  title: z.string().min(3).max(150).optional(),
  description: z.string().min(5).max(4000).optional(),
});

export const createCommentSchema = z.object({
  message: z.string().min(1, "El mensaje no puede estar vacío").max(4000),
  internal: z.boolean().optional(),
});
