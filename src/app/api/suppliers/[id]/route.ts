import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { supplierSchema } from "@/lib/validations/supplier";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/suppliers/[id]">) {
  const { error } = await requireStaff();
  if (error) return error;
  const { id } = await ctx.params;

  const body = await req.json();
  const parsed = supplierSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supplier = await prisma.supplier.update({ where: { id }, data: parsed.data });
  return NextResponse.json(supplier);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/suppliers/[id]">) {
  const { error } = await requireStaff();
  if (error) return error;
  const { id } = await ctx.params;

  await prisma.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
