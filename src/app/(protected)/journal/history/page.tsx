import { JournalHistory } from "@/modules/journal/history";
import { requireProfile } from "@/modules/auth/session";
import { todayInMadrid } from "@/modules/shared/today";
export default async function HistoryPage() {
  await requireProfile();
  return <JournalHistory today={todayInMadrid()} />;
}
