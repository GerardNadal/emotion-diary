import { JournalHistory } from "@/modules/journal/history";
import { requireProfile } from "@/modules/auth/session";
export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireProfile();
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : "";
  const to = typeof params.to === "string" ? params.to : "";
  return <JournalHistory key={`${from}:${to}`} initialFrom={from} initialTo={to} />;
}
