import { PersonalResources } from "@/modules/journal/resources";
import { requireProfile } from "@/modules/auth/session";
export default async function RecommendationsPage() {
  await requireProfile();
  return <PersonalResources />;
}
