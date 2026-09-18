"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadField } from "@/components/ui/file-upload-field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ASSET_CATEGORY_LABEL, ASSET_STATUS_LABEL } from "@/lib/validations/asset";

type UserOption = { id: string; name: string };
type AssetData = {
  id: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string | null;
  status: string;
  area: string | null;
  assignedToId: string | null;
  damageNotes: string | null;
  notes: string | null;
  handoverDocUrl: string | null;
};

export function AssetFormDialog({
  users,
  asset,
}: {
  users: UserOption[];
  asset?: AssetData;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!asset;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      category: form.get("category"),
      brand: form.get("brand"),
      model: form.get("model"),
      serialNumber: form.get("serialNumber") || null,
      status: form.get("status"),
      area: form.get("area") || null,
      assignedToId: form.get("assignedToId") || null,
      damageNotes: form.get("damageNotes") || null,
      notes: form.get("notes") || null,
      handoverDocUrl: form.get("handoverDocUrl") || null,
    };

    const res = await fetch(isEdit ? `/api/assets/${asset!.id}` : "/api/assets", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!res.ok) {
      setError("No se pudo guardar el equipo.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

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
            Nuevo equipo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar equipo" : "Nuevo equipo"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Categoría</Label>
              <Select name="category" required defaultValue={asset?.category ?? "LAPTOP"}>
                {Object.entries(ASSET_CATEGORY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Estado</Label>
              <Select name="status" required defaultValue={asset?.status ?? "ACTIVE"}>
                {Object.entries(ASSET_STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Marca</Label>
              <Input name="brand" required defaultValue={asset?.brand} placeholder="Ej. Dell" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Modelo</Label>
              <Input name="model" required defaultValue={asset?.model} placeholder="Ej. Latitude 5420" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Número de serie</Label>
              <Input name="serialNumber" defaultValue={asset?.serialNumber ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Área</Label>
              <Input name="area" defaultValue={asset?.area ?? ""} placeholder="Ej. Operaciones" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Asignado a</Label>
            <Select name="assignedToId" defaultValue={asset?.assignedToId ?? ""}>
              <option value="">Sin asignar</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>

          <FileUploadField
            name="handoverDocUrl"
            label="Acta de entrega (documento firmado)"
            defaultUrl={asset?.handoverDocUrl}
          />

          <div className="flex flex-col gap-1.5">
            <Label>Notas sobre daño (si aplica)</Label>
            <Textarea name="damageNotes" rows={2} defaultValue={asset?.damageNotes ?? ""} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Notas generales</Label>
            <Textarea name="notes" rows={2} defaultValue={asset?.notes ?? ""} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear equipo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
