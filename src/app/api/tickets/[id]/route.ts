import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateTicketSchema } from "@/lib/validations/ticket";
import { emitToTicket } from "@/lib/socket-emit";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/tickets/[id]">) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      type: true,
      requester: true,
      assignee: true,
      asset: true,
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      history: { include: { user: true }, orderBy: { createdAt: "desc" } },
      attachments: true,
    },
  });

  if (!ticket) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const isStaff = session.user.role === "ADMIN" || session.user.role === "AGENT";
  if (!isStaff && ticket.requesterId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return NextResponse.json(ticket);
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/tickets/[id]">) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const isStaff = session.user.role === "ADMIN" || session.user.role === "AGENT";
  if (!isStaff) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const parsed = updateTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const changes = parsed.data;
  const historyEntries: { field: string; oldValue: string | null; newValue: string | null }[] = [];

  if (changes.status && changes.status !== existing.status) {
    historyEntries.push({ field: "status", oldValue: existing.status, newValue: changes.status });
  }
  if (changes.priority && changes.priority !== existing.priority) {
    historyEntries.push({ field: "priority", oldValue: existing.priority, newValue: changes.priority });
  }
  if (changes.assigneeId !== undefined && changes.assigneeId !== existing.assigneeId) {
    historyEntries.push({
      field: "assignee",
      oldValue: existing.assigneeId,
      newValue: changes.assigneeId,
    });
  }

  const now = new Date();
  const ticket = await prisma.ticket.update({
    where: { id },
    data: {
      ...changes,
      resolvedAt: changes.status === "RESOLVED" ? now : existing.resolvedAt,
      closedAt: changes.status === "CLOSED" ? now : existing.closedAt,
    },
    include: { type: true, requester: true, assignee: true, asset: true },
  });

  if (historyEntries.length > 0) {
    await prisma.ticketHistory.createMany({
      data: historyEntries.map((h) => ({ ...h, ticketId: id, userId: session.user.id })),
    });
  }

  emitToTicket(id, "ticket:updated", ticket);

  return NextResponse.json(ticket);
}
