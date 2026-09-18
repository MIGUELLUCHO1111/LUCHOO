"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FREQUENCY_LABEL, MAINTENANCE_STATUS_LABEL } from "@/lib/validations/maintenance";

type AssetOption = { id: string; code: string; brand: string; model: string };
type PlanData = {
  id: string;
  assetId: string;
  frequency: string;
  status: string;
  lastDoneAt: string | Date | null;
  nextDueAt: string | Date;
  notes: string | null;
};

export function MaintenanceFormDialog({
  assets,
  plan,
}: {
  assets: AssetOption[];
  plan?: PlanData;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!plan;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      assetId: form.get("assetId"),
      frequency: form.get("frequency"),
      status: form.get("status"),
      lastDoneAt: form.get("lastDoneAt") || null,
      nextDueAt: form.get("nextDueAt"),
      notes: form.get("notes") || null,
    };

    const res = await fetch(isEdit ? `/api/maintenance/${plan!.id}` : "/api/maintenance", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!res.ok) {
      setError("No se pudo guardar el plan de mantenimiento.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const toDateInput = (d: string | Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <button className="rounded-md p-1.5 text-muted hover:bg-brand-blue-50 hover:text-brand-blue">
            <Pencil className="h-4 w-4" />
          </button>
        ) : (
          <Button variant="accent">
            <Plus className="h-4 w-4" />
            Nuevo plan
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar plan de mantenimiento" : "Nuevo plan de mantenimiento"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Equipo</Label>
            <Select name="assetId" required defaultValue={plan?.assetId ?? ""}>
              <option value="" disabled>
                Selecciona...
              </option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.brand} {a.model}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Frecuencia</Label>
              <Select name="frequency" required defaultValue={plan?.frequency ?? "QUARTERLY"}>
                {Object.entries(FREQUENCY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Estado</Label>
              <Select name="status" required defaultValue={plan?.status ?? "PENDING"}>
                {Object.entries(MAINTENANCE_STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Último mantenimiento</Label>
              <Input name="lastDoneAt" type="date" defaultValue={toDateInput(plan?.lastDoneAt ?? null)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Próximo mantenimiento</Label>
              <Input
                name="nextDueAt"
                type="date"
                required
                defaultValue={toDateInput(plan?.nextDueAt ?? null)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Notas</Label>
            <Textarea name="notes" rows={2} defaultValue={plan?.notes ?? ""} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
