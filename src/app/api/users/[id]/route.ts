import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { updateUserSchema } from "@/lib/validations/user";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { password, ...rest } = parsed.data;
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
  });

  return NextResponse.json(user);
}
