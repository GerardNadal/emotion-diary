import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell, TableCaption } from "@/components/ui/table";
import { roleLabels } from "@/modules/auth/roles";
import { getDirectory } from "@/modules/administration/queries";
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = Math.min(10000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const directory = await getDirectory(page);
  const teamNames = new Map(directory.teams.map((team) => [team.id, team.name]));
  return <><div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">Personas</h1>
    <Link href="/admin/users/new" className={buttonVariants()}>Crear usuario</Link></div>
    <p className="text-muted-foreground">{directory.actor.role === "company_admin" ? "Cuentas de toda la empresa." : "Tu cuenta y los empleados de tus equipos."} Desactivar una cuenta bloquea su acceso inmediatamente.</p>
    <Table><TableCaption>{directory.count} cuentas autorizadas</TableCaption><TableHeader><TableRow>
      <TableHead>Nombre</TableHead><TableHead>Correo</TableHead><TableHead>Rol</TableHead><TableHead>Equipo</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead>
    </TableRow></TableHeader><TableBody>{directory.profiles.map((profile) => <TableRow key={profile.id}>
      <TableCell>{profile.full_name}</TableCell><TableCell>{profile.email}</TableCell><TableCell>{roleLabels[profile.role]}</TableCell>
      <TableCell>{profile.team_id ? teamNames.get(profile.team_id) : "—"}</TableCell>
      <TableCell><Badge variant={profile.active ? "secondary" : "outline"}>{profile.active ? "Activo" : "Desactivado"}</Badge></TableCell>
      <TableCell>{directory.actor.role === "company_admin" || profile.role === "employee" ?
        <Link href={`/admin/users/${profile.id}`} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label={`Editar ${profile.full_name}`}>Editar</Link> : "—"}</TableCell>
    </TableRow>)}</TableBody></Table>
    {directory.count === 0 ? <p>No hay cuentas para mostrar.</p> : null}
    <nav aria-label="Paginación" className="flex items-center gap-3">
      {page > 1 ? <Link href={`/admin/users?page=${page - 1}`} className={buttonVariants({ variant: "outline" })}>Anterior</Link> : null}
      <span className="text-sm">Página {page}</span>
      {page * directory.size < directory.count ? <Link href={`/admin/users?page=${page + 1}`} className={buttonVariants({ variant: "outline" })}>Siguiente</Link> : null}
    </nav>
  </>;
}
