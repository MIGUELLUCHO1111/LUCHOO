import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCommentSchema } from "@/lib/validations/ticket";
import { emitToTicket } from "@/lib/socket-emit";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/tickets/[id]/comments">) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const isStaff = session.user.role === "ADMIN" || session.user.role === "AGENT";
  if (!isStaff && ticket.requesterId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: id,
      authorId: session.user.id,
      message: parsed.data.message,
      internal: isStaff ? !!parsed.data.internal : false,
    },
    include: { author: true },
  });

  emitToTicket(id, "comment:new", comment);

  return NextResponse.json(comment, { status: 201 });
}
