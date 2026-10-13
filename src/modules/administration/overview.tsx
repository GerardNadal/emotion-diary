import Link from "next/link";
import { ArrowRight, Plus, UsersRound } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { AggregateInsights } from "./aggregate-insights";

export function AdministrationOverview({
  company,
  employees,
  activeEmployees,
  teams,
}: {
  company: boolean;
  employees: number;
  activeEmployees: number;
  teams: { id: string; name: string }[];
}) {
  return (
    <>
      <PageHeading
        title={company ? "Mi empresa" : "Mis equipos"}
        action={
          <Link href="/admin/users/new" className={buttonVariants()}>
            <Plus data-icon="inline-start" />
            {company ? "Añadir persona" : "Añadir empleado"}
          </Link>
        }
      />
      <div className="admin-metrics">
        <section className="admin-metric">
          <p>Empleados</p>
          <strong>{employees}</strong>
          <small>{company ? "En la empresa" : "En tus equipos"}</small>
        </section>
        <section className="admin-metric">
          <p>Cuentas activas</p>
          <strong>{activeEmployees}</strong>
          <small>Empleados con acceso</small>
        </section>
        <section className="admin-metric">
          <p>Equipos</p>
          <strong>{teams.length}</strong>
          <small>
            {company ? "Creados en la empresa" : "Bajo tu responsabilidad"}
          </small>
        </section>
      </div>
      <div className="admin-links">
        <Link
          href="/admin/users"
          className={buttonVariants({ variant: "outline" })}
        >
          Gestionar personas
          <ArrowRight data-icon="inline-end" />
        </Link>
        <Link
          href="/admin/teams"
          className={buttonVariants({ variant: "ghost" })}
        >
          {company ? "Gestionar equipos" : "Ver mis equipos"}
          <ArrowRight data-icon="inline-end" />
        </Link>
      </div>
      <AggregateInsights company={company} teams={teams} variant="summary" />
      <section className="surface">
        <div className="section-heading">
          <h2>{company ? "Equipos de la empresa" : "Tus equipos"}</h2>
          <Link href="/admin/teams" className="text-xs text-primary">
            Ver todos
          </Link>
        </div>
        {teams.length ? (
          <div className="admin-team-list">
            {teams.slice(0, 5).map((team) => (
              <div className="admin-team-row" key={team.id}>
                <strong>{team.name}</strong>
                <Link href="/admin/teams">
                  Ver equipo
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={UsersRound}
            title={
              company
                ? "Sin equipos"
                : "Todavía no tienes equipos asignados"
            }
            description={
              company
                ? "Crea un equipo para empezar a organizar a las personas de tu empresa."
                : "La administración de empresa puede asignarte uno o varios equipos."
            }
          >
            {company ? (
              <Link
                href="/admin/teams"
                className={buttonVariants({ variant: "outline" })}
              >
                Crear equipo
              </Link>
            ) : null}
          </EmptyState>
        )}
      </section>
    </>
  );
}
