import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SoftwareFormDialog } from "@/components/software/software-form-dialog";
import { formatDate } from "@/lib/utils";

export default async function SoftwarePage() {
  const [licenses, suppliers] = await Promise.all([
    prisma.softwareLicense.findMany({ orderBy: { name: "asc" }, include: { supplier: true } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);

  const now = new Date();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-brand-blue-dark">Software licenciado</h1>
          <p className="text-sm text-muted">Licencias, asientos y vencimientos</p>
        </div>
        <SoftwareFormDialog suppliers={suppliers} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {licenses.length === 0 && (
              <p className="p-8 text-center text-sm text-muted">Aún no hay licencias registradas.</p>
            )}
            {licenses.map((l) => {
              const expiringSoon =
                l.expiresAt && l.expiresAt.getTime() - now.getTime() < 1000 * 60 * 60 * 24 * 30;
              const expired = l.expiresAt && l.expiresAt.getTime() < now.getTime();
              return (
                <div key={l.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-brand-blue-dark">{l.name}</span>
                      {l.licenseType && <Badge variant="outline">{l.licenseType}</Badge>}
                    </div>
                    <p className="text-xs text-muted">
                      {l.seatsUsed}/{l.seats} asientos en uso
                      {l.supplier ? ` · ${l.supplier.name}` : ""}
                      {l.expiresAt ? ` · Vence ${formatDate(l.expiresAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {expired && <Badge variant="cancelled">Vencida</Badge>}
                    {!expired && expiringSoon && <Badge variant="pending">Por vencer</Badge>}
                    <SoftwareFormDialog
                      suppliers={suppliers}
                      license={{
                        id: l.id,
                        name: l.name,
                        licenseType: l.licenseType,
                        seats: l.seats,
                        seatsUsed: l.seatsUsed,
                        expiresAt: l.expiresAt,
                        supplierId: l.supplierId,
                        notes: l.notes,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
