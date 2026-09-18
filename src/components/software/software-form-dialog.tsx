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

type SupplierOption = { id: string; name: string };
type LicenseData = {
  id: string;
  name: string;
  licenseType: string | null;
  seats: number;
  seatsUsed: number;
  expiresAt: string | Date | null;
  supplierId: string | null;
  notes: string | null;
};

export function SoftwareFormDialog({
  suppliers,
  license,
}: {
  suppliers: SupplierOption[];
  license?: LicenseData;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!license;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      licenseType: form.get("licenseType") || null,
      seats: form.get("seats"),
      seatsUsed: form.get("seatsUsed"),
      expiresAt: form.get("expiresAt") || null,
      supplierId: form.get("supplierId") || null,
      notes: form.get("notes") || null,
    };

    const res = await fetch(isEdit ? `/api/software/${license!.id}` : "/api/software", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!res.ok) {
      setError("No se pudo guardar la licencia.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const expiresDefault = license?.expiresAt
    ? new Date(license.expiresAt).toISOString().slice(0, 10)
    : "";

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
            Nueva licencia
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar licencia" : "Nueva licencia de software"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Nombre del software</Label>
            <Input name="name" required defaultValue={license?.name} placeholder="Ej. Microsoft 365" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Tipo de licencia</Label>
              <Input name="licenseType" defaultValue={license?.licenseType ?? ""} placeholder="Ej. Suscripción anual" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Vence el</Label>
              <Input name="expiresAt" type="date" defaultValue={expiresDefault} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Asientos totales</Label>
              <Input name="seats" type="number" min={1} required defaultValue={license?.seats ?? 1} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Asientos en uso</Label>
              <Input name="seatsUsed" type="number" min={0} required defaultValue={license?.seatsUsed ?? 0} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Proveedor</Label>
            <Select name="supplierId" defaultValue={license?.supplierId ?? ""}>
              <option value="">Ninguno</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Notas</Label>
            <Textarea name="notes" rows={2} defaultValue={license?.notes ?? ""} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear licencia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
