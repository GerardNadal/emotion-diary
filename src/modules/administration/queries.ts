import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/modules/auth/session";

export async function getDirectory(page = 1) {
  const actor = await requireProfile(["company_admin", "team_admin"]);
  const supabase = await createClient();
  const size = 25;
  const [profiles, teams, managers, assignments] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .order("full_name")
      .order("id")
      .range((page - 1) * size, page * size - 1),
    supabase.from("teams").select("*").order("name"),
    actor.role === "company_admin"
      ? supabase
          .from("profiles")
          .select("*")
          .eq("role", "team_admin")
          .eq("active", true)
          .order("full_name")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("team_managers").select("*"),
  ]);
  if (profiles.error || teams.error || managers.error || assignments.error) {
    throw new Error("No se ha podido cargar la administración.");
  }
  return {
    actor,
    profiles: profiles.data ?? [],
    teams: teams.data ?? [],
    managers: managers.data ?? [],
    assignments: assignments.data ?? [],
    count: profiles.count ?? 0,
    page,
    size,
  };
}

export async function getProfileForEdit(id: string) {
  await requireProfile(["company_admin", "team_admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("No se ha podido consultar el usuario.");
  return data;
}

// Exact administrative counts across the actor's RLS scope, never emotional data.
// Do not derive totals from the paginated directory.
export async function getAdministrationOverview() {
  const actor = await requireProfile(["company_admin", "team_admin"]);
  const supabase = await createClient();
  const [employees, activeEmployees, teams] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "employee"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "employee")
      .eq("active", true),
    supabase.from("teams").select("id, name").order("name"),
  ]);
  if (employees.error || activeEmployees.error || teams.error) {
    throw new Error("No se ha podido cargar el resumen de administración.");
  }
  return {
    actor,
    employees: employees.count ?? 0,
    activeEmployees: activeEmployees.count ?? 0,
    teams: teams.data ?? [],
  };
}
