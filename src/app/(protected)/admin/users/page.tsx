import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Directory } from "@/modules/administration/directory";
import { getDirectory } from "@/modules/administration/queries";
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.min(
    10000,
    Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
  );
  const directory = await getDirectory(page);
  return (
    <>
      <PageHeading
        title="Personas"
        description={
          directory.actor.role === "company_admin"
            ? "Gestiona las cuentas y asignaciones de la empresa."
            : "Tu cuenta y los empleados de los equipos que gestionas."
        }
        action={
          <Link href="/admin/users/new" className={buttonVariants()}>
            <Plus data-icon="inline-start" />
            Añadir persona
          </Link>
        }
      />
      <Directory
        profiles={directory.profiles}
        teams={directory.teams}
        actorRole={directory.actor.role}
      />
      <nav aria-label="Paginación" className="pagination">
        {page > 1 ? (
          <Link
            href={`/admin/users?page=${page - 1}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Anterior
          </Link>
        ) : null}
        <span>
          Página {page} · {directory.count} cuentas autorizadas
        </span>
        {page * directory.size < directory.count ? (
          <Link
            href={`/admin/users?page=${page + 1}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Siguiente
          </Link>
        ) : null}
      </nav>
    </>
  );
}
