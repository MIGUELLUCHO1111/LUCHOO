import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { softwareLicenseSchema } from "@/lib/validations/software";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;

  const licenses = await prisma.softwareLicense.findMany({
    orderBy: { name: "asc" },
    include: { supplier: true },
  });
  return NextResponse.json(licenses);
}

export async function POST(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const body = await req.json();
  const parsed = softwareLicenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { expiresAt, ...rest } = parsed.data;
  const license = await prisma.softwareLicense.create({
    data: { ...rest, expiresAt: expiresAt ? new Date(expiresAt) : null },
    include: { supplier: true },
  });

  return NextResponse.json(license, { status: 201 });
}
