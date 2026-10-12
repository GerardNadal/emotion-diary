import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { requireProfile } from "@/modules/auth/session";
export default async function CompanyPage() {
  await requireProfile(["company_admin"]);
  return <><h1 className="text-2xl font-semibold">Administración de empresa</h1>
    <p className="text-muted-foreground">Gestiona equipos, responsables y cuentas de toda la empresa.</p>
    <div className="flex flex-wrap gap-3"><Link href="/admin/users" className={buttonVariants()}>Gestionar personas</Link>
      <Link href="/admin/teams" className={buttonVariants({ variant: "outline" })}>Gestionar equipos</Link></div>
    <DashboardPlaceholder title="Estadísticas de empresa" description="Aquí consultarás estadísticas agregadas. Los diarios individuales son privados." />
  </>;
}
