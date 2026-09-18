import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { maintenancePlanSchema } from "@/lib/validations/maintenance";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/maintenance/[id]">) {
  const { error } = await requireStaff();
  if (error) return error;
  const { id } = await ctx.params;

  const body = await req.json();
  const parsed = maintenancePlanSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { lastDoneAt, nextDueAt, ...rest } = parsed.data;
  const plan = await prisma.maintenancePlan.update({
    where: { id },
    data: {
      ...rest,
      ...(lastDoneAt !== undefined ? { lastDoneAt: lastDoneAt ? new Date(lastDoneAt) : null } : {}),
      ...(nextDueAt !== undefined ? { nextDueAt: new Date(nextDueAt) } : {}),
    },
    include: { asset: true },
  });

  return NextResponse.json(plan);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/maintenance/[id]">) {
  const { error } = await requireStaff();
  if (error) return error;
  const { id } = await ctx.params;

  await prisma.maintenancePlan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
