import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }
  return { session, error: null };
}

export async function requireStaff() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }
  if (session.user.role === "REQUESTER") {
    return { session: null, error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return { session, error: null };
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN") {
    return { session: null, error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return { session, error: null };
}
