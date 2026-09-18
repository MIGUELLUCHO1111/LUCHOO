import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { nextAssetCode } from "@/lib/codes";
import { assetSchema } from "@/lib/validations/asset";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;

  const assets = await prisma.asset.findMany({
    orderBy: { createdAt: "desc" },
    include: { assignedTo: true },
  });
  return NextResponse.json(assets);
}

export async function POST(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const body = await req.json();
  const parsed = assetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const code = await nextAssetCode();
  const asset = await prisma.asset.create({
    data: {
      code,
      ...parsed.data,
      assignedAt: parsed.data.assignedToId ? new Date() : null,
    },
    include: { assignedTo: true },
  });

  return NextResponse.json(asset, { status: 201 });
}
