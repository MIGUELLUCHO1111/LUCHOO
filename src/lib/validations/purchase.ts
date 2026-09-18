import { z } from "zod";

export const purchaseSchema = z.object({
  description: z.string().min(2, "La descripción es obligatoria").max(500),
  cost: z.coerce.number().min(0),
  currency: z.string().min(1).max(10).default("USD"),
  purchaseDate: z.string().min(1, "Selecciona la fecha"),
  supplierId: z.string().optional().nullable(),
  assetId: z.string().optional().nullable(),
  ticketId: z.string().optional().nullable(),
  invoiceUrl: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
