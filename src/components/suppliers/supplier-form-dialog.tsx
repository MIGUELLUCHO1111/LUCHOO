"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type SupplierData = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  services: string | null;
  notes: string | null;
};

export function SupplierFormDialog({ supplier }: { supplier?: SupplierData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!supplier;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      contactName: form.get("contactName") || null,
      phone: form.get("phone") || null,
      email: form.get("email") || null,
      services: form.get("services") || null,
      notes: form.get("notes") || null,
    };

    const res = await fetch(isEdit ? `/api/suppliers/${supplier!.id}` : "/api/suppliers", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!res.ok) {
      setError("No se pudo guardar el proveedor.");
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
            Nuevo proveedor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Nombre de la empresa</Label>
            <Input name="name" required defaultValue={supplier?.name} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Persona de contacto</Label>
              <Input name="contactName" defaultValue={supplier?.contactName ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Teléfono</Label>
              <Input name="phone" defaultValue={supplier?.phone ?? ""} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Correo</Label>
            <Input name="email" type="email" defaultValue={supplier?.email ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Servicios que ofrece</Label>
            <Textarea name="services" rows={2} defaultValue={supplier?.services ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notas</Label>
            <Textarea name="notes" rows={2} defaultValue={supplier?.notes ?? ""} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear proveedor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
