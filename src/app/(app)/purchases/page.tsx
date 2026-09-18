import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { PurchaseFormDialog } from "@/components/purchases/purchase-form-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function PurchasesPage() {
  const [purchases, suppliers, assets, tickets] = await Promise.all([
    prisma.purchase.findMany({
      orderBy: { purchaseDate: "desc" },
      include: { supplier: true, asset: true, ticket: true },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.asset.findMany({ orderBy: { code: "asc" } }),
    prisma.ticket.findMany({ orderBy: { code: "asc" } }),
  ]);

  const supplierOptions = suppliers.map((s) => ({ id: s.id, label: s.name }));
  const assetOptions = assets.map((a) => ({ id: a.id, label: `${a.code} · ${a.brand} ${a.model}` }));
  const ticketOptions = tickets.map((t) => ({ id: t.id, label: `${t.code} · ${t.title}` }));

  const total = purchases.reduce((sum, p) => sum + p.cost, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-brand-blue-dark">Compras de TI</h1>
          <p className="text-sm text-muted">
            Total registrado: <span className="font-semibold text-brand-blue-dark">{formatCurrency(total)}</span>
          </p>
        </div>
        <PurchaseFormDialog suppliers={supplierOptions} assets={assetOptions} tickets={ticketOptions} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {purchases.length === 0 && (
              <p className="p-8 text-center text-sm text-muted">Aún no hay compras registradas.</p>
            )}
            {purchases.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted">{p.code}</span>
                    <span className="font-medium text-brand-blue-dark">{p.description}</span>
                  </div>
                  <p className="text-xs text-muted">
                    {formatDate(p.purchaseDate)}
                    {p.supplier ? ` · ${p.supplier.name}` : ""}
                    {p.asset ? ` · ${p.asset.code}` : ""}
                    {p.ticket ? ` · ${p.ticket.code}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-brand-blue-dark">
                    {formatCurrency(p.cost, p.currency)}
                  </span>
                  <PurchaseFormDialog
                    suppliers={supplierOptions}
                    assets={assetOptions}
                    tickets={ticketOptions}
                    purchase={{
                      id: p.id,
                      description: p.description,
                      cost: p.cost,
                      currency: p.currency,
                      purchaseDate: p.purchaseDate,
                      supplierId: p.supplierId,
                      assetId: p.assetId,
                      ticketId: p.ticketId,
                      invoiceUrl: p.invoiceUrl,
                      notes: p.notes,
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
