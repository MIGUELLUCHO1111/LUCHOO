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
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime } from "@/lib/utils";
import { PRIORITY_LABEL, STATUS_BADGE, STATUS_LABEL } from "@/lib/ticket-meta";

const ACCENTS = [
  "var(--color-brand-blue)",
  "var(--color-brand-yellow)",
  "var(--color-brand-blue-light)",
  "var(--color-brand-yellow-dark)",
  "var(--color-brand-blue-dark)",
  "var(--color-brand-blue)",
];

const PRIORITY_ACCENT: Record<string, string> = {
  LOW: "var(--color-brand-blue-100)",
  MEDIUM: "var(--color-brand-blue-light)",
  HIGH: "var(--color-brand-yellow)",
  URGENT: "var(--color-brand-yellow-dark)",
};

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
    { label: "Registrados", value: registered, icon: ClipboardList },
    { label: "Asignados", value: assigned, icon: Rocket },
    { label: "En proceso", value: inProgress, icon: FlaskConical },
    { label: "Finalizados", value: resolved, icon: CalendarCheck2 },
    { label: "Cancelados", value: cancelled, icon: XCircle },
  ];

  const modules = isStaff
    ? [
        { href: "/assets", label: "Inventario de equipos", desc: "Laptops, desktops e impresoras", icon: Laptop },
        { href: "/software", label: "Software licenciado", desc: "Licencias y vencimientos", icon: KeyRound },
        { href: "/maintenance", label: "Mantenimiento preventivo", desc: "Calendario por equipo", icon: Wrench },
        { href: "/purchases", label: "Compras de TI", desc: "Órdenes y comprobantes", icon: ShoppingCart },
        { href: "/suppliers", label: "Proveedores de TI", desc: "Directorio de contactos", icon: Truck },
        { href: "/assets?status=DAMAGED", label: "Equipos dañados", desc: "Seguimiento de daños", icon: AlertTriangle },
      ]
    : [];

  const today = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-white p-6">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-[0.07]"
          style={{ background: "var(--color-brand-yellow)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 right-24 h-32 w-32 rounded-full opacity-[0.06]"
          style={{ background: "var(--color-brand-blue)" }}
        />
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium capitalize text-muted">{today}</p>
            <h1 className="mt-0.5 text-2xl font-bold text-brand-blue-dark">
              Hola, {session!.user.name?.split(" ")[0]}
              <span className="ml-1 inline-block text-brand-yellow">.</span>
            </h1>
            <p className="text-sm text-muted">
              {isStaff
                ? "Resumen general del departamento de TI"
                : "Resumen de tus solicitudes"}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-border bg-brand-blue-50 px-3 py-1.5 text-xs font-medium text-brand-blue-dark sm:self-auto">
            <Sparkles className="h-3.5 w-3.5 text-brand-yellow-dark" />
            {isStaff ? "Panel de TI" : "Mi panel"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        {stats.map((s, i) => {
          const accent = ACCENTS[i % ACCENTS.length];
          return (
            <Link key={s.label} href="/tickets" className="group">
              <Card
                className="relative h-full cursor-pointer overflow-hidden border-t-[3px] transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-card-hover)]"
                style={{ borderTopColor: accent }}
              >
                <div
                  className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-[0.08] transition-transform duration-300 group-hover:scale-125"
                  style={{ background: accent }}
                />
                <CardContent className="relative flex flex-col gap-3 p-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm transition-transform duration-200 group-hover:scale-110"
                    style={{ background: accent }}
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
          );
        })}
      </div>

      <div className={cn("grid grid-cols-1 gap-5", modules.length > 0 && "lg:grid-cols-3")}>
        <Card className={cn(modules.length > 0 && "lg:col-span-2")}>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-blue-dark">
                <span className="h-4 w-1 rounded-full bg-brand-yellow" />
                {isStaff ? "Tickets recientes" : "Mis tickets recientes"}
              </h2>
              <Link
                href="/tickets"
                className="flex items-center gap-0.5 text-sm font-medium text-brand-blue transition-transform hover:translate-x-0.5"
              >
                Ver todos
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {recentTickets.length === 0 && (
                <p className="p-8 text-center text-sm text-muted">Aún no hay tickets.</p>
              )}
              {recentTickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/tickets/${t.id}`}
                  className="group flex items-stretch gap-3 transition-colors hover:bg-brand-blue-50/50"
                >
                  <span
                    className="w-1 shrink-0 transition-all duration-200 group-hover:w-1.5"
                    style={{ background: PRIORITY_ACCENT[t.priority] }}
                  />
                  <div className="flex flex-1 flex-col gap-2 py-3.5 pr-4 sm:flex-row sm:items-center sm:justify-between">
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
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {modules.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="border-b border-border p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-blue-dark">
                  <span className="h-4 w-1 rounded-full bg-brand-blue" />
                  Accesos rápidos
                </h2>
              </div>
              <div className="divide-y divide-border">
                {modules.map((m, i) => {
                  const accent = ACCENTS[i % ACCENTS.length];
                  return (
                    <Link
                      key={m.href}
                      href={m.href}
                      className="group relative flex items-center gap-3 overflow-hidden py-3.5 pl-4 pr-3 transition-colors hover:bg-brand-blue-50/40"
                    >
                      <span
                        className="absolute left-0 top-0 h-full w-0 transition-all duration-200 group-hover:w-1"
                        style={{ background: accent }}
                      />
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
                        style={{ background: `color-mix(in srgb, ${accent} 16%, white)`, color: accent }}
                      >
                        <m.icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-brand-blue-dark">{m.label}</p>
                        <p className="truncate text-xs text-muted">{m.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-all duration-200 group-hover:translate-x-1 group-hover:text-brand-blue" />
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
