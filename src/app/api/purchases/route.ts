import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { nextPurchaseCode } from "@/lib/codes";
import { purchaseSchema } from "@/lib/validations/purchase";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;

  const purchases = await prisma.purchase.findMany({
    orderBy: { purchaseDate: "desc" },
    include: { supplier: true, asset: true, ticket: true },
  });
  return NextResponse.json(purchases);
}

export async function POST(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const body = await req.json();
  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const code = await nextPurchaseCode();
  const { purchaseDate, ...rest } = parsed.data;
  const purchase = await prisma.purchase.create({
    data: { code, ...rest, purchaseDate: new Date(purchaseDate) },
    include: { supplier: true, asset: true, ticket: true },
  });

  return NextResponse.json(purchase, { status: 201 });
}
