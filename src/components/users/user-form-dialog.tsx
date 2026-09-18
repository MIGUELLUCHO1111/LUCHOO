"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ROLE_LABEL } from "@/lib/validations/user";

type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  active: boolean;
};

export function UserFormDialog({ user }: { user?: UserData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!user;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const password = form.get("password") as string;

    const payload = isEdit
      ? {
          name: form.get("name"),
          role: form.get("role"),
          department: form.get("department") || null,
          active: form.get("active") === "true",
          ...(password ? { password } : {}),
        }
      : {
          name: form.get("name"),
          email: form.get("email"),
          password,
          role: form.get("role"),
          department: form.get("department") || null,
        };

    const res = await fetch(isEdit ? `/api/users/${user!.id}` : "/api/users", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!res.ok) {
      setError("No se pudo guardar el usuario. Verifica los datos (el correo debe ser único).");
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
            Nuevo usuario
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Nombre completo</Label>
            <Input name="name" required defaultValue={user?.name} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Correo</Label>
            <Input name="email" type="email" required disabled={isEdit} defaultValue={user?.email} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Rol</Label>
              <Select name="role" required defaultValue={user?.role ?? "REQUESTER"}>
                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Departamento</Label>
              <Input name="department" defaultValue={user?.department ?? ""} />
            </div>
          </div>

          {isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label>Estado</Label>
              <Select name="active" defaultValue={String(user?.active ?? true)}>
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>{isEdit ? "Nueva contraseña (opcional)" : "Contraseña"}</Label>
            <Input name="password" type="password" required={!isEdit} minLength={6} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
