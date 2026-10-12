import type { AppRole } from "@/lib/supabase/database.types";
import { homeForRole } from "@/modules/auth/roles";

export function navigationForRole(role: AppRole) {
  const personal = [
    {
      href: role === "employee" ? "/employee" : "/journal",
      label: "Mi espacio",
      icon: "home",
    },
    { href: "/journal/history", label: "Mi diario", icon: "journal" },
    { href: "/insights", label: "Mi evolución", icon: "chart" },
    { href: "/recommendations", label: "Para ti", icon: "leaf" },
    { href: "/profile", label: "Mi perfil", icon: "profile" },
  ] as const;
  const administration =
    role === "employee"
      ? []
      : [
          { href: homeForRole(role), label: "Resumen", icon: "chart" },
          { href: "/admin/users", label: "Personas", icon: "users" },
          { href: "/admin/teams", label: "Equipos", icon: "teams" },
          {
            href: "/admin/insights",
            label: "Bienestar agregado",
            icon: "heart",
          },
        ];
  return { personal, administration };
}

export function isNavigationActive(pathname: string, href: string) {
  if (href === "/employee") return pathname === href || pathname === "/journal";
  if (href === "/journal") return pathname === href;
  if (href === "/journal/history")
    return pathname === href || pathname === "/journal/new";
  return pathname === href || pathname.startsWith(`${href}/`);
}
