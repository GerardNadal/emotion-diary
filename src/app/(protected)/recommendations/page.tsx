import { PersonalResources } from "@/modules/journal/resources";
import { requireProfile } from "@/modules/auth/session";
import { listEntries } from "@/modules/journal/actions";
import { emotions } from "@/modules/journal/emotions";
export default async function RecommendationsPage() {
  await requireProfile();
  const result = await listEntries({ timezone: "UTC" });
  const entries = result.ok ? result.data.entries.map(entry => ({
    id: entry.id,
    label: `${new Intl.DateTimeFormat("es", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(entry.occurred_at))} · ${emotions.find(e => e.value === entry.emotion)?.label ?? "Mi momento"}`,
  })) : [];
  return <PersonalResources entries={entries} error={result.ok ? undefined : result.message} />;
}
