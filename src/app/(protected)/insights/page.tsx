import { PersonalInsights } from "@/modules/journal/personal-insights";
import { requireProfile } from "@/modules/auth/session";
export default async function InsightsPage() {
  await requireProfile();
  return <PersonalInsights />;
}
