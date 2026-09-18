import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { softwareLicenseSchema } from "@/lib/validations/software";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/software/[id]">) {
  const { error } = await requireStaff();
  if (error) return error;
  const { id } = await ctx.params;

  const body = await req.json();
  const parsed = softwareLicenseSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { expiresAt, ...rest } = parsed.data;
  const license = await prisma.softwareLicense.update({
    where: { id },
    data: { ...rest, ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}) },
    include: { supplier: true },
  });

  return NextResponse.json(license);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/software/[id]">) {
  const { error } = await requireStaff();
  if (error) return error;
  const { id } = await ctx.params;

  await prisma.softwareLicense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
