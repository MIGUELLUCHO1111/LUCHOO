"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { PRIORITY_LABEL, PRIORITY_OPTIONS } from "@/lib/ticket-meta";

type TicketType = { id: string; name: string };
type AssetOption = { id: string; code: string; brand: string; model: string };

export function NewTicketDialog({
  types,
  assets,
}: {
  types: TicketType[];
  assets: AssetOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      title: form.get("title"),
      description: form.get("description"),
      typeId: form.get("typeId"),
      priority: form.get("priority"),
      department: form.get("department") || null,
      assetId: form.get("assetId") || null,
    };

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      setError("No se pudo crear el ticket. Revisa los campos.");
      return;
    }

    const ticket = await res.json();
    setOpen(false);
    router.push(`/tickets/${ticket.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent">
          <Plus className="h-4 w-4" />
          Nuevo ticket
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo ticket</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Título</Label>
            <Input id="title" name="title" required placeholder="Ej. No enciende el equipo" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="typeId">Tipo de solicitud</Label>
              <Select id="typeId" name="typeId" required defaultValue="">
                <option value="" disabled>
                  Selecciona...
                </option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="priority">Prioridad</Label>
              <Select id="priority" name="priority" required defaultValue="MEDIUM">
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              name="description"
              required
              rows={4}
              placeholder="Describe el problema o la solicitud con el mayor detalle posible..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="department">Área / Departamento</Label>
              <Input id="department" name="department" placeholder="Opcional" />
            </div>
            {assets.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="assetId">Equipo relacionado</Label>
                <Select id="assetId" name="assetId" defaultValue="">
                  <option value="">Ninguno</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.brand} {a.model}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
