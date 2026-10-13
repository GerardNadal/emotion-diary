import { PageHeading } from "@/components/page-heading";
import { AggregateInsights } from "@/modules/administration/aggregate-insights";
import { getAdministrationOverview } from "@/modules/administration/queries";
export default async function AggregatePage() {
  const { actor, teams } = await getAdministrationOverview();
  const company = actor.role === "company_admin";
  return (
    <>
      <PageHeading
        title="Bienestar agregado"
        description="Una perspectiva compartida que respeta el espacio de cada persona."
      />
      <AggregateInsights company={company} teams={teams} />
    </>
  );
}
