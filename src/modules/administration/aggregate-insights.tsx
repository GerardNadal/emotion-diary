import { allowedPeriods } from "./reporting-model";
import { loadCollectiveStatistics } from "./reporting-actions";
import { ReportingPanel } from "./reporting-panel";
export async function AggregateInsights({ company, teams }: { company: boolean; teams: { id: string; name: string }[] }) {
  const periods = allowedPeriods();
  const query = { team: company ? null : teams[0]?.id ?? null, period: periods[0].period, grain: periods[0].grain };
  const initial = !company && !teams.length ? { data: null, error: null } : await loadCollectiveStatistics(query);
  return <ReportingPanel company={company} teams={teams} periods={periods} initial={initial} initialQuery={query} />;
}
