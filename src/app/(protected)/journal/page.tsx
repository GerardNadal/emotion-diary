import { PersonalHome } from "@/modules/journal/personal-home";
import { requireProfile } from "@/modules/auth/session";
export default async function JournalPage() {
  const profile = await requireProfile();
  return <PersonalHome name={profile.full_name} />;
}
