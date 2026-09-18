import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { maintenancePlanSchema } from "@/lib/validations/maintenance";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;

  const plans = await prisma.maintenancePlan.findMany({
    orderBy: { nextDueAt: "asc" },
    include: { asset: true },
  });
  return NextResponse.json(plans);
}

export async function POST(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const body = await req.json();
  const parsed = maintenancePlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { lastDoneAt, nextDueAt, ...rest } = parsed.data;
  const plan = await prisma.maintenancePlan.create({
    data: {
      ...rest,
      lastDoneAt: lastDoneAt ? new Date(lastDoneAt) : null,
      nextDueAt: new Date(nextDueAt),
    },
    include: { asset: true },
  });

  return NextResponse.json(plan, { status: 201 });
}
