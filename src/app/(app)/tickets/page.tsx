import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { PRIORITY_LABEL, STATUS_BADGE, STATUS_LABEL } from "@/lib/ticket-meta";
import { TicketFilters } from "@/components/tickets/ticket-filters";
import { NewTicketDialog } from "@/components/tickets/new-ticket-dialog";

export default async function TicketsPage(props: PageProps<"/tickets">) {
  const searchParams = await props.searchParams;
  const session = await auth();
  const isStaff = session!.user.role === "ADMIN" || session!.user.role === "AGENT";

  const status = typeof searchParams.status === "string" ? searchParams.status : undefined;
  const priority = typeof searchParams.priority === "string" ? searchParams.priority : undefined;
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;

  const [tickets, types, assets] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        ...(isStaff ? {} : { requesterId: session!.user.id }),
        ...(status ? { status: status as never } : {}),
        ...(priority ? { priority: priority as never } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { code: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { type: true, requester: true, assignee: true },
    }),
    prisma.ticketType.findMany({ orderBy: { name: "asc" } }),
    isStaff
      ? prisma.asset.findMany({ orderBy: { code: "asc" } })
      : prisma.asset.findMany({ where: { assignedToId: session!.user.id }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-brand-blue-dark">Tickets</h1>
          <p className="text-sm text-muted">
            {isStaff ? "Todas las solicitudes del departamento" : "Tus solicitudes"}
          </p>
        </div>
        <NewTicketDialog types={types} assets={assets} />
      </div>

      <TicketFilters />

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {tickets.length === 0 && (
              <p className="p-8 text-center text-sm text-muted">
                No hay tickets que coincidan con el filtro.
              </p>
            )}
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/tickets/${t.id}`}
                className="flex flex-col gap-2 p-4 hover:bg-brand-blue-50/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted">{t.code}</span>
                    <span className="font-medium text-brand-blue-dark">{t.title}</span>
                  </div>
                  <p className="text-xs text-muted">
                    {t.type.name} · {t.requester.name}
                    {t.assignee ? ` · Asignado a ${t.assignee.name}` : " · Sin asignar"} ·{" "}
                    {formatDateTime(t.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{PRIORITY_LABEL[t.priority]}</Badge>
                  <Badge variant={STATUS_BADGE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
