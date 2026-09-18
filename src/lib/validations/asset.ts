import { z } from "zod";

export const assetSchema = z.object({
  category: z.enum(["LAPTOP", "DESKTOP", "PRINTER", "MONITOR", "NETWORK", "PHONE", "OTHER"]),
  brand: z.string().min(1, "La marca es obligatoria").max(100),
  model: z.string().min(1, "El modelo es obligatorio").max(100),
  serialNumber: z.string().max(120).optional().nullable(),
  status: z.enum(["ACTIVE", "IN_REPAIR", "DAMAGED", "RETIRED", "IN_STORAGE"]),
  area: z.string().max(100).optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  damageNotes: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  handoverDocUrl: z.string().max(500).optional().nullable(),
});

export const ASSET_CATEGORY_LABEL: Record<string, string> = {
  LAPTOP: "Laptop",
  DESKTOP: "Desktop",
  PRINTER: "Impresora",
  MONITOR: "Monitor",
  NETWORK: "Equipo de red",
  PHONE: "Teléfono",
  OTHER: "Otro",
};

export const ASSET_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activo",
  IN_REPAIR: "En reparación",
  DAMAGED: "Dañado",
  RETIRED: "De baja",
  IN_STORAGE: "En almacén",
};
