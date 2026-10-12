import { PersonalHome } from "@/modules/journal/personal-home";
import { requireProfile } from "@/modules/auth/session";
export default async function EmployeePage() {
  const profile = await requireProfile(["employee"]);
  return <PersonalHome name={profile.full_name} />;
}
