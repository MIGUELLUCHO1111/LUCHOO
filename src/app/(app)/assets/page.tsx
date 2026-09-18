import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssetFormDialog } from "@/components/assets/asset-form-dialog";
import { ASSET_CATEGORY_LABEL, ASSET_STATUS_LABEL } from "@/lib/validations/asset";
import { cn, formatDate } from "@/lib/utils";

const STATUS_BADGE: Record<string, "resolved" | "pending" | "cancelled" | "closed" | "open"> = {
  ACTIVE: "resolved",
  IN_REPAIR: "pending",
  DAMAGED: "cancelled",
  RETIRED: "closed",
  IN_STORAGE: "open",
};

export default async function AssetsPage(props: PageProps<"/assets">) {
  const searchParams = await props.searchParams;
  const status = typeof searchParams.status === "string" ? searchParams.status : undefined;

  const [assets, users] = await Promise.all([
    prisma.asset.findMany({
      where: status ? { status: status as never } : {},
      orderBy: { createdAt: "desc" },
      include: { assignedTo: true },
    }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-brand-blue-dark">Inventario de equipos</h1>
          <p className="text-sm text-muted">Laptops, desktops, impresoras y otros dispositivos</p>
        </div>
        <AssetFormDialog users={users} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/assets"
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            !status ? "bg-brand-blue text-white" : "bg-brand-blue-50 text-brand-blue"
          )}
        >
          Todos
        </Link>
        {Object.entries(ASSET_STATUS_LABEL).map(([value, label]) => (
          <Link
            key={value}
            href={`/assets?status=${value}`}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              status === value ? "bg-brand-blue text-white" : "bg-brand-blue-50 text-brand-blue"
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {assets.length === 0 && (
              <p className="p-8 text-center text-sm text-muted">Aún no hay equipos registrados.</p>
            )}
            {assets.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted">{a.code}</span>
                    <span className="font-medium text-brand-blue-dark">
                      {a.brand} {a.model}
                    </span>
                    <Badge variant="outline">{ASSET_CATEGORY_LABEL[a.category]}</Badge>
                  </div>
                  <p className="text-xs text-muted">
                    {a.serialNumber ? `S/N ${a.serialNumber} · ` : ""}
                    {a.area ? `${a.area} · ` : ""}
                    {a.assignedTo ? `Asignado a ${a.assignedTo.name}` : "Sin asignar"} · Registrado{" "}
                    {formatDate(a.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_BADGE[a.status]}>{ASSET_STATUS_LABEL[a.status]}</Badge>
                  <AssetFormDialog
                    users={users}
                    asset={{
                      id: a.id,
                      category: a.category,
                      brand: a.brand,
                      model: a.model,
                      serialNumber: a.serialNumber,
                      status: a.status,
                      area: a.area,
                      assignedToId: a.assignedToId,
                      damageNotes: a.damageNotes,
                      notes: a.notes,
                      handoverDocUrl: a.handoverDocUrl,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
