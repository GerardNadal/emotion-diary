import { PersonalInsights } from "@/modules/journal/personal-insights";
import { requireProfile } from "@/modules/auth/session";
import { todayInMadrid } from "@/modules/shared/today";
export default async function InsightsPage() {
  await requireProfile();
  return <PersonalInsights today={todayInMadrid()} />;
}
