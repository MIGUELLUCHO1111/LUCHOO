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

type Option = { id: string; label: string };
type PurchaseData = {
  id: string;
  description: string;
  cost: number;
  currency: string;
  purchaseDate: string | Date;
  supplierId: string | null;
  assetId: string | null;
  ticketId: string | null;
  invoiceUrl: string | null;
  notes: string | null;
};

export function PurchaseFormDialog({
  suppliers,
  assets,
  tickets,
  purchase,
}: {
  suppliers: Option[];
  assets: Option[];
  tickets: Option[];
  purchase?: PurchaseData;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!purchase;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      description: form.get("description"),
      cost: form.get("cost"),
      currency: form.get("currency"),
      purchaseDate: form.get("purchaseDate"),
      supplierId: form.get("supplierId") || null,
      assetId: form.get("assetId") || null,
      ticketId: form.get("ticketId") || null,
      invoiceUrl: form.get("invoiceUrl") || null,
      notes: form.get("notes") || null,
    };

    const res = await fetch(isEdit ? `/api/purchases/${purchase!.id}` : "/api/purchases", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!res.ok) {
      setError("No se pudo guardar la compra.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const dateDefault = purchase?.purchaseDate
    ? new Date(purchase.purchaseDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

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
            Nueva compra
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar compra" : "Nueva compra de TI"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Descripción</Label>
            <Textarea
              name="description"
              required
              rows={2}
              defaultValue={purchase?.description}
              placeholder="Ej. 5 licencias de Windows 11 Pro"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Costo</Label>
              <Input name="cost" type="number" step="0.01" min={0} required defaultValue={purchase?.cost} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Moneda</Label>
              <Input name="currency" defaultValue={purchase?.currency ?? "USD"} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Fecha de compra</Label>
            <Input name="purchaseDate" type="date" required defaultValue={dateDefault} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Proveedor</Label>
            <Select name="supplierId" defaultValue={purchase?.supplierId ?? ""}>
              <option value="">Ninguno</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Equipo relacionado</Label>
              <Select name="assetId" defaultValue={purchase?.assetId ?? ""}>
                <option value="">Ninguno</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Ticket relacionado</Label>
              <Select name="ticketId" defaultValue={purchase?.ticketId ?? ""}>
                <option value="">Ninguno</option>
                {tickets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <FileUploadField name="invoiceUrl" label="Factura / comprobante" defaultUrl={purchase?.invoiceUrl} />

          <div className="flex flex-col gap-1.5">
            <Label>Notas</Label>
            <Textarea name="notes" rows={2} defaultValue={purchase?.notes ?? ""} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Registrar compra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
