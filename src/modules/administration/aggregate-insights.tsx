import { allowedPeriods } from "./reporting-model";
import { loadCollectiveStatistics } from "./reporting-actions";
import { ReportingPanel } from "./reporting-panel";
import { ReportingSummary } from "./reporting-summary";
export async function AggregateInsights({ company, teams, variant = "full" }: { company: boolean; teams: { id: string; name: string }[]; variant?: "full" | "summary" }) {
  const periods = allowedPeriods();
  const query = { team: company ? null : teams[0]?.id ?? null, period: periods[0].period, grain: periods[0].grain };
  const initial = !company && !teams.length ? { data: null, error: null } : await loadCollectiveStatistics(query);
  if (variant === "summary") return <ReportingSummary
    result={initial}
    periodLabel={periods[0].label}
    scope={company ? "Empresa" : teams[0]?.name ?? "Sin equipos asignados"}
  />;
  return <ReportingPanel company={company} teams={teams} periods={periods} initial={initial} initialQuery={query} />;
}
