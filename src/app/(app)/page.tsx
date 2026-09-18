import Link from "next/link";
import {
  ClipboardList,
  Rocket,
  FlaskConical,
  CalendarCheck2,
  XCircle,
  Laptop,
  KeyRound,
  Wrench,
  ShoppingCart,
  Truck,
  AlertTriangle,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { PRIORITY_LABEL, STATUS_BADGE, STATUS_LABEL } from "@/lib/ticket-meta";

export default async function DashboardPage() {
  const session = await auth();
  const role = session!.user.role;
  const userId = session!.user.id;
  const isStaff = role === "ADMIN" || role === "AGENT";

  const scope = isStaff ? {} : { requesterId: userId };

  const [registered, assigned, inProgress, resolved, cancelled, recentTickets] =
    await Promise.all([
      prisma.ticket.count({ where: { ...scope } }),
      prisma.ticket.count({ where: { ...scope, assigneeId: { not: null } } }),
      prisma.ticket.count({ where: { ...scope, status: "IN_PROGRESS" } }),
      prisma.ticket.count({
        where: { ...scope, status: { in: ["RESOLVED", "CLOSED"] } },
      }),
      prisma.ticket.count({ where: { ...scope, status: "CANCELLED" } }),
      prisma.ticket.findMany({
        where: { ...scope },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { type: true, requester: true, assignee: true },
      }),
    ]);

  const stats = [
    { label: "Registrados", value: registered, icon: ClipboardList, tone: "blue" as const },
    { label: "Asignados", value: assigned, icon: Rocket, tone: "yellow" as const },
    { label: "En proceso", value: inProgress, icon: FlaskConical, tone: "blue" as const },
    { label: "Finalizados", value: resolved, icon: CalendarCheck2, tone: "yellow" as const },
    { label: "Cancelados", value: cancelled, icon: XCircle, tone: "muted" as const },
  ];

  const modules = isStaff
    ? [
        { href: "/assets", label: "Inventario de equipos", icon: Laptop },
        { href: "/software", label: "Software licenciado", icon: KeyRound },
        { href: "/maintenance", label: "Mantenimiento preventivo", icon: Wrench },
        { href: "/purchases", label: "Compras de TI", icon: ShoppingCart },
        { href: "/suppliers", label: "Proveedores de TI", icon: Truck },
        { href: "/assets?status=DAMAGED", label: "Equipos dañados", icon: AlertTriangle },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-brand-blue-dark">
          Hola, {session!.user.name?.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted">
          {isStaff
            ? "Resumen general del departamento de TI"
            : "Resumen de tus solicitudes"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href="/tickets">
            <Card className="h-full cursor-pointer">
              <CardContent className="flex flex-col gap-3 p-4">
                <div
                  className={
                    s.tone === "blue"
                      ? "flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue text-white"
                      : s.tone === "yellow"
                      ? "flex h-10 w-10 items-center justify-center rounded-lg bg-brand-yellow text-brand-blue-dark"
                      : "flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200 text-slate-600"
                  }
                >
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-brand-blue-dark">{s.value}</p>
                  <p className="text-sm text-muted">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {modules.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Accesos rápidos
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {modules.map((m) => (
              <Link key={m.href} href={m.href}>
                <Card className="h-full cursor-pointer">
                  <CardContent className="flex flex-col items-center gap-2 p-5 text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue">
                      <m.icon className="h-5.5 w-5.5" />
                    </div>
                    <p className="text-sm font-medium text-brand-blue-dark">{m.label}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-sm font-semibold text-brand-blue-dark">
              {isStaff ? "Tickets recientes" : "Mis tickets recientes"}
            </h2>
            <Link href="/tickets" className="text-sm text-brand-blue hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentTickets.length === 0 && (
              <p className="p-6 text-center text-sm text-muted">Aún no hay tickets.</p>
            )}
            {recentTickets.map((t) => (
              <Link
                key={t.id}
                href={`/tickets/${t.id}`}
                className="flex flex-col gap-2 p-4 hover:bg-brand-blue-50/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted">{t.code}</span>
                    <span className="font-medium text-brand-blue-dark">{t.title}</span>
                  </div>
                  <p className="text-xs text-muted">
                    {t.type.name} · Solicitado por {t.requester.name} ·{" "}
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
