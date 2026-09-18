"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import { STATUS_LABEL, PRIORITY_LABEL, STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/ticket-meta";

type StaffUser = { id: string; name: string };

export function TicketActions({
  ticketId,
  status,
  priority,
  assigneeId,
  staffUsers,
}: {
  ticketId: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  staffUsers: StaffUser[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function update(field: string, value: string) {
    setSaving(true);
    await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value || null }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className={`flex flex-col gap-3 ${saving ? "opacity-60" : ""}`}>
      <div className="flex flex-col gap-1.5">
        <Label>Estado</Label>
        <Select
          defaultValue={status}
          onChange={(e) => update("status", e.target.value)}
          disabled={saving}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Prioridad</Label>
        <Select
          defaultValue={priority}
          onChange={(e) => update("priority", e.target.value)}
          disabled={saving}
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Asignado a</Label>
        <Select
          defaultValue={assigneeId ?? ""}
          onChange={(e) => update("assigneeId", e.target.value)}
          disabled={saving}
        >
          <option value="">Sin asignar</option>
          {staffUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
