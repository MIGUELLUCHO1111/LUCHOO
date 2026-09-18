import { z } from "zod";

export const maintenancePlanSchema = z.object({
  assetId: z.string().min(1, "Selecciona un equipo"),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]),
  status: z.enum(["PENDING", "DONE", "OVERDUE"]),
  lastDoneAt: z.string().optional().nullable(),
  nextDueAt: z.string().min(1, "Define la próxima fecha"),
  notes: z.string().max(2000).optional().nullable(),
});

export const FREQUENCY_LABEL: Record<string, string> = {
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
};

export const MAINTENANCE_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  DONE: "Realizado",
  OVERDUE: "Atrasado",
};
