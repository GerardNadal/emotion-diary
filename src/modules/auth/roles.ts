import type { AppRole } from "@/lib/supabase/database.types";
export const roleLabels: Record<AppRole, string> = {
  company_admin: "Administrador de empresa", team_admin: "Administrador de equipo", employee: "Empleado",
};
export function homeForRole(role: AppRole) {
  return { company_admin: "/company", team_admin: "/team", employee: "/employee" }[role];
}
