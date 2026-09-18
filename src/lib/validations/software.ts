import { z } from "zod";

export const softwareLicenseSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio").max(150),
  licenseType: z.string().max(100).optional().nullable(),
  seats: z.coerce.number().int().min(1),
  seatsUsed: z.coerce.number().int().min(0),
  expiresAt: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
