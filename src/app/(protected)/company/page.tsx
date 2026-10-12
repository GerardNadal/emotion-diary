import { AdministrationOverview } from "@/modules/administration/overview";
import { getAdministrationOverview } from "@/modules/administration/queries";
import { requireProfile } from "@/modules/auth/session";
export default async function CompanyPage() {
  await requireProfile(["company_admin"]);
  const overview = await getAdministrationOverview();
  return <AdministrationOverview company {...overview} />;
}
