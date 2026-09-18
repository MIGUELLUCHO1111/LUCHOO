import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextTicketCode } from "@/lib/codes";
import { createTicketSchema } from "@/lib/validations/ticket";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const isStaff = session.user.role === "ADMIN" || session.user.role === "AGENT";
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const search = searchParams.get("q");

  const where = {
    ...(isStaff ? {} : { requesterId: session.user.id }),
    ...(status ? { status: status as never } : {}),
    ...(priority ? { priority: priority as never } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search } },
            { code: { contains: search } },
            { description: { contains: search } },
          ],
        }
      : {}),
  };

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { type: true, requester: true, assignee: true },
  });

  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const code = await nextTicketCode();
  const ticket = await prisma.ticket.create({
    data: {
      code,
      title: parsed.data.title,
      description: parsed.data.description,
      typeId: parsed.data.typeId,
      priority: parsed.data.priority,
      department: parsed.data.department || null,
      assetId: parsed.data.assetId || null,
      requesterId: session.user.id,
    },
    include: { type: true, requester: true, assignee: true },
  });

  await prisma.ticketHistory.create({
    data: {
      ticketId: ticket.id,
      userId: session.user.id,
      field: "status",
      oldValue: null,
      newValue: "OPEN",
    },
  });

  return NextResponse.json(ticket, { status: 201 });
}
