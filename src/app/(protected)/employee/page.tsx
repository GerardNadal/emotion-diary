import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { requireProfile } from "@/modules/auth/session";
export default async function EmployeePage() {
  const profile = await requireProfile(["employee"]);
  return <><h1 className="text-2xl font-semibold">Mi espacio</h1>
    <p className="text-muted-foreground">Hola, {profile.full_name}. Tu diario será privado, también frente a la administración.</p>
    <div className="grid gap-4 md:grid-cols-2">
      <DashboardPlaceholder title="Diario e historial" description="Registra tus emociones y consulta tus entradas personales." />
      <DashboardPlaceholder title="Estadísticas personales" description="Conoce tu evolución con información accesible solo para ti." />
      <DashboardPlaceholder title="Recomendaciones" description="Un espacio reservado para las futuras recomendaciones de IA." />
    </div>
  </>;
}
