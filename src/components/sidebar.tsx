"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Ticket,
  Laptop,
  KeyRound,
  Wrench,
  ShoppingCart,
  Truck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  staffOnly?: boolean;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/assets", label: "Inventario de equipos", icon: Laptop, staffOnly: true },
  { href: "/software", label: "Software licenciado", icon: KeyRound, staffOnly: true },
  { href: "/maintenance", label: "Mantenimiento preventivo", icon: Wrench, staffOnly: true },
  { href: "/purchases", label: "Compras de TI", icon: ShoppingCart, staffOnly: true },
  { href: "/suppliers", label: "Proveedores", icon: Truck, staffOnly: true },
  { href: "/users", label: "Usuarios", icon: Users, adminOnly: true },
];

export function Sidebar({
  role,
  open,
  onClose,
}: {
  role: "ADMIN" | "AGENT" | "REQUESTER";
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return role === "ADMIN";
    if (item.staffOnly) return role === "ADMIN" || role === "AGENT";
    return true;
  });

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-brand-blue-dark/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-blue text-white transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow">
              <span className="text-base font-black text-brand-blue-dark">FP</span>
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Fullpetro TI</p>
              <p className="text-xs text-white/60 leading-tight">Tickets e Inventario</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {items.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-yellow text-brand-blue-dark shadow-sm"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="h-4.5 w-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-4 text-xs text-white/50">
          © {new Date().getFullYear()} Fullpetro
        </div>
      </aside>
    </>
  );
}
