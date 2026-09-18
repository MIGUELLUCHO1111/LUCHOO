import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MaintenanceFormDialog } from "@/components/maintenance/maintenance-form-dialog";
import { FREQUENCY_LABEL, MAINTENANCE_STATUS_LABEL } from "@/lib/validations/maintenance";
import { formatDate } from "@/lib/utils";

const STATUS_BADGE: Record<string, "resolved" | "pending" | "cancelled"> = {
  DONE: "resolved",
  PENDING: "pending",
  OVERDUE: "cancelled",
};

export default async function MaintenancePage() {
  const [plans, assets] = await Promise.all([
    prisma.maintenancePlan.findMany({ orderBy: { nextDueAt: "asc" }, include: { asset: true } }),
    prisma.asset.findMany({ orderBy: { code: "asc" } }),
  ]);

  const now = new Date();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-brand-blue-dark">Mantenimiento preventivo</h1>
          <p className="text-sm text-muted">Calendario de mantenimientos por equipo</p>
        </div>
        <MaintenanceFormDialog assets={assets} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {plans.length === 0 && (
              <p className="p-8 text-center text-sm text-muted">Aún no hay planes de mantenimiento.</p>
            )}
            {plans.map((p) => {
              const overdue = p.status !== "DONE" && p.nextDueAt.getTime() < now.getTime();
              const effectiveStatus = overdue ? "OVERDUE" : p.status;
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted">{p.asset.code}</span>
                      <span className="font-medium text-brand-blue-dark">
                        {p.asset.brand} {p.asset.model}
                      </span>
                      <Badge variant="outline">{FREQUENCY_LABEL[p.frequency]}</Badge>
                    </div>
                    <p className="text-xs text-muted">
                      Próximo: {formatDate(p.nextDueAt)}
                      {p.lastDoneAt ? ` · Último: ${formatDate(p.lastDoneAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_BADGE[effectiveStatus]}>
                      {MAINTENANCE_STATUS_LABEL[effectiveStatus]}
                    </Badge>
                    <MaintenanceFormDialog
                      assets={assets}
                      plan={{
                        id: p.id,
                        assetId: p.assetId,
                        frequency: p.frequency,
                        status: p.status,
                        lastDoneAt: p.lastDoneAt,
                        nextDueAt: p.nextDueAt,
                        notes: p.notes,
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
