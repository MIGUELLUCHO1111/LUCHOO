import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/utils";
import { PRIORITY_LABEL, STATUS_BADGE, STATUS_LABEL } from "@/lib/ticket-meta";
import { TicketChat } from "@/components/tickets/ticket-chat";
import { TicketActions } from "@/components/tickets/ticket-actions";

export default async function TicketDetailPage(props: PageProps<"/tickets/[id]">) {
  const { id } = await props.params;
  const session = await auth();
  const isStaff = session!.user.role === "ADMIN" || session!.user.role === "AGENT";

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      type: true,
      requester: true,
      assignee: true,
      asset: true,
      comments: {
        where: isStaff ? {} : { internal: false },
        include: { author: true },
        orderBy: { createdAt: "asc" },
      },
      history: { include: { user: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!ticket) notFound();
  if (!isStaff && ticket.requesterId !== session!.user.id) notFound();

  const staffUsers = isStaff
    ? await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "AGENT"] }, active: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/tickets"
          className="mb-2 inline-flex items-center gap-1 text-sm text-brand-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a tickets
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm text-muted">{ticket.code}</span>
          <h1 className="text-xl font-semibold text-brand-blue-dark">{ticket.title}</h1>
          <Badge variant={STATUS_BADGE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
          <Badge variant="outline">{PRIORITY_LABEL[ticket.priority]}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue="chat" className="w-full">
                <div className="border-b border-border px-4 pt-4">
                  <TabsList>
                    <TabsTrigger value="chat">Chat</TabsTrigger>
                    <TabsTrigger value="history">Historial</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="chat" className="px-4 pb-4">
                  <TicketChat
                    ticketId={ticket.id}
                    initialComments={ticket.comments}
                    currentUserId={session!.user.id}
                    isStaff={isStaff}
                  />
                </TabsContent>
                <TabsContent value="history" className="px-4 pb-4">
                  <div className="flex flex-col gap-3">
                    {ticket.history.length === 0 && (
                      <p className="py-6 text-center text-sm text-muted">Sin cambios registrados.</p>
                    )}
                    {ticket.history.map((h) => (
                      <div key={h.id} className="flex items-start gap-3 text-sm">
                        <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-yellow" />
                        <div>
                          <p className="text-brand-blue-dark">
                            <span className="font-medium">{h.user.name}</span> cambió{" "}
                            <span className="font-medium">{h.field}</span>{" "}
                            {h.oldValue ? `de "${h.oldValue}" ` : ""}
                            a &quot;{h.newValue}&quot;
                          </p>
                          <p className="text-xs text-muted">{formatDateTime(h.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Detalles</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <InfoRow label="Tipo" value={ticket.type.name} />
              <InfoRow label="Solicitante" value={ticket.requester.name} />
              <InfoRow label="Área" value={ticket.department || "—"} />
              {ticket.asset && (
                <InfoRow
                  label="Equipo"
                  value={`${ticket.asset.code} · ${ticket.asset.brand} ${ticket.asset.model}`}
                />
              )}
              <InfoRow label="Creado" value={formatDateTime(ticket.createdAt)} />
              {ticket.resolvedAt && (
                <InfoRow label="Resuelto" value={formatDateTime(ticket.resolvedAt)} />
              )}
              <div className="rounded-lg bg-brand-blue-50 p-3 text-sm text-brand-blue-dark">
                {ticket.description}
              </div>
            </CardContent>
          </Card>

          {isStaff && (
            <Card>
              <CardHeader>
                <CardTitle>Gestión</CardTitle>
              </CardHeader>
              <CardContent>
                <TicketActions
                  ticketId={ticket.id}
                  status={ticket.status}
                  priority={ticket.priority}
                  assigneeId={ticket.assigneeId}
                  staffUsers={staffUsers}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-brand-blue-dark">{value}</span>
    </div>
  );
}
