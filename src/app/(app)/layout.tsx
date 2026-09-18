import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) return null; // middleware ya redirige a /login

  return (
    <AppShell
      user={{
        name: session.user.name ?? "Usuario",
        email: session.user.email ?? "",
        role: session.user.role,
      }}
    >
      {children}
    </AppShell>
  );
}
