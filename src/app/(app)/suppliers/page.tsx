import { Mail, Phone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";

export default async function SuppliersPage() {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-brand-blue-dark">Proveedores de TI</h1>
          <p className="text-sm text-muted">Directorio de proveedores y contactos</p>
        </div>
        <SupplierFormDialog />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {suppliers.length === 0 && (
          <p className="col-span-full p-8 text-center text-sm text-muted">
            Aún no hay proveedores registrados.
          </p>
        )}
        {suppliers.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex flex-col gap-2 p-5">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-brand-blue-dark">{s.name}</h3>
                <SupplierFormDialog supplier={s} />
              </div>
              {s.contactName && <p className="text-sm text-muted">{s.contactName}</p>}
              {s.phone && (
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  <Phone className="h-3.5 w-3.5" /> {s.phone}
                </p>
              )}
              {s.email && (
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  <Mail className="h-3.5 w-3.5" /> {s.email}
                </p>
              )}
              {s.services && (
                <p className="mt-1 rounded-lg bg-brand-blue-50 p-2 text-xs text-brand-blue-dark">
                  {s.services}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
