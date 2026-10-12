import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { requireProfile } from "@/modules/auth/session";
export default async function TeamPage() {
  await requireProfile(["team_admin"]);
  return <><h1 className="text-2xl font-semibold">Administración de equipo</h1>
    <p className="text-muted-foreground">Gestiona los empleados de los equipos de los que eres responsable.</p>
    <div><Link href="/admin/users" className={buttonVariants()}>Gestionar empleados</Link></div>
    <DashboardPlaceholder title="Estadísticas de mis equipos" description="Aquí consultarás exclusivamente agregados de tus equipos, sin acceso a registros individuales." />
  </>;
}
