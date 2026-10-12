import { AdministrationOverview } from "@/modules/administration/overview";
import { getAdministrationOverview } from "@/modules/administration/queries";
import { requireProfile } from "@/modules/auth/session";
export default async function TeamPage() {
  await requireProfile(["team_admin"]);
  const overview = await getAdministrationOverview();
  return <AdministrationOverview company={false} {...overview} />;
}
