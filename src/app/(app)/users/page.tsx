import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { ROLE_LABEL } from "@/lib/validations/user";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") notFound();

  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-brand-blue-dark">Usuarios</h1>
          <p className="text-sm text-muted">Administra el acceso al sistema</p>
        </div>
        <UserFormDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-brand-blue-dark">{u.name}</span>
                    <Badge variant="outline">{ROLE_LABEL[u.role]}</Badge>
                    {!u.active && <Badge variant="cancelled">Inactivo</Badge>}
                  </div>
                  <p className="text-xs text-muted">
                    {u.email}
                    {u.department ? ` · ${u.department}` : ""}
                  </p>
                </div>
                <UserFormDialog
                  user={{
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.role,
                    department: u.department,
                    active: u.active,
                  }}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
