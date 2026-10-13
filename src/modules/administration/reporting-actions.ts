"use server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/modules/auth/session";
import { collectiveDashboard, reportingQuery, type ReportingQuery, type ReportingResult } from "./reporting-model";
export async function loadCollectiveStatistics(input: ReportingQuery): Promise<ReportingResult> {
  await requireProfile(["company_admin", "team_admin"]);
  const parsed = reportingQuery.safeParse(input);
  if (!parsed.success) return { data: null, error: "Selecciona un equipo y un período permitido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("collective_statistics", { p_team_id: parsed.data.team, p_period: parsed.data.period, p_grain: parsed.data.grain });
  if (error) return { data: null, error: "No se han podido cargar las estadísticas. Comprueba tu acceso e inténtalo de nuevo." };
  const result = collectiveDashboard.safeParse(data);
  if (!result.success) return { data: null, error: "Las estadísticas no están disponibles en este momento." };
  return { data: result.data, error: null };
}
