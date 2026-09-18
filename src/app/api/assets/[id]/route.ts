import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { assetSchema } from "@/lib/validations/asset";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/assets/[id]">) {
  const { error } = await requireStaff();
  if (error) return error;
  const { id } = await ctx.params;

  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const parsed = assetSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const assignedToChanged =
    parsed.data.assignedToId !== undefined && parsed.data.assignedToId !== existing.assignedToId;

  const asset = await prisma.asset.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(assignedToChanged
        ? { assignedAt: parsed.data.assignedToId ? new Date() : null }
        : {}),
    },
    include: { assignedTo: true },
  });

  return NextResponse.json(asset);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/assets/[id]">) {
  const { error } = await requireStaff();
  if (error) return error;
  const { id } = await ctx.params;

  await prisma.asset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
