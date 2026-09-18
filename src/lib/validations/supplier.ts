import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio").max(150),
  contactName: z.string().max(150).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email("Correo inválido").max(150).optional().nullable().or(z.literal("")),
  services: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
