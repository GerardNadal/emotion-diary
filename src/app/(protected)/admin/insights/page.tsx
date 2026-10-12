import { PageHeading } from "@/components/page-heading";
import { AggregateInsights } from "@/modules/administration/aggregate-insights";
import { getAdministrationOverview } from "@/modules/administration/queries";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
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
      <section className="surface">
        <h2>
          {company ? "Tendencias entre equipos" : "Factores en el trabajo"}
        </h2>
        <EmptyState
          icon={ChartNoAxesColumnIncreasing}
          title="Este espacio aún no tiene datos"
          description={
            company
              ? "La comparación entre equipos se habilitará con estadísticas agregadas y suficientes participantes. No se muestran resultados individuales."
              : "Aquí podrás ver tendencias temporales y factores laborales agregados de tus equipos cuando se conecte el módulo de estadísticas."
          }
        />
      </section>
    </>
  );
}
