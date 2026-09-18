import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { purchaseSchema } from "@/lib/validations/purchase";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/purchases/[id]">) {
  const { error } = await requireStaff();
  if (error) return error;
  const { id } = await ctx.params;

  const body = await req.json();
  const parsed = purchaseSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { purchaseDate, ...rest } = parsed.data;
  const purchase = await prisma.purchase.update({
    where: { id },
    data: { ...rest, ...(purchaseDate ? { purchaseDate: new Date(purchaseDate) } : {}) },
    include: { supplier: true, asset: true, ticket: true },
  });

  return NextResponse.json(purchase);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/purchases/[id]">) {
  const { error } = await requireStaff();
  if (error) return error;
  const { id } = await ctx.params;

  await prisma.purchase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
