import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireProfile } from "@/modules/auth/session";
import { homeForRole, roleLabels } from "@/modules/auth/roles";
import { logoutAction } from "@/modules/auth/actions";
export const dynamic = "force-dynamic";
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const administrator = profile.role !== "employee";
  return <div className="min-h-screen bg-background">
    <a className="sr-only focus:not-sr-only" href="#main">Ir al contenido</a>
    <header className="border-b"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex flex-col gap-1"><Link className="font-semibold" href={homeForRole(profile.role)}>Diario emocional</Link>
        <span className="text-sm text-muted-foreground">{profile.full_name}</span></div>
      <Badge variant="secondary">{roleLabels[profile.role]}</Badge>
      <nav aria-label="Navegación principal" className="flex flex-wrap items-center gap-2">
        <Link href={homeForRole(profile.role)} className={buttonVariants({ variant: "ghost" })}>Inicio</Link>
        {administrator ? <Link href="/admin/users" className={buttonVariants({ variant: "ghost" })}>Personas</Link> : null}
        {administrator ? <Link href="/admin/teams" className={buttonVariants({ variant: "ghost" })}>Equipos</Link> : null}
        <Link href="/update-password" className={buttonVariants({ variant: "ghost" })}>Contraseña</Link>
        <form action={logoutAction}><Button variant="outline" type="submit">Cerrar sesión</Button></form>
      </nav>
    </div></header>
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-6 p-6">{children}</main>
  </div>;
}
