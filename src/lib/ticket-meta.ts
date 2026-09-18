import type { TicketPriority, TicketStatus } from "@prisma/client";

export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En proceso",
  PENDING: "Pendiente",
  RESOLVED: "Resuelto",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};

export const STATUS_BADGE: Record<
  TicketStatus,
  "open" | "progress" | "pending" | "resolved" | "closed" | "cancelled"
> = {
  OPEN: "open",
  IN_PROGRESS: "progress",
  PENDING: "pending",
  RESOLVED: "resolved",
  CLOSED: "closed",
  CANCELLED: "cancelled",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const STATUS_OPTIONS: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];

export const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
