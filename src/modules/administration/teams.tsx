import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ActionForm } from "@/components/forms/action-form";
import { TextField, SelectField } from "@/components/forms/inputs";
import type {
  AppRole,
  Team,
  Profile,
  TeamManager,
} from "@/lib/supabase/database.types";
import {
  saveTeamAction,
  setManagerAction,
} from "@/modules/administration/actions";
import { UsersRound } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function TeamManagement({
  actorRole,
  teams,
  managers,
  assignments,
}: {
  actorRole: AppRole;
  teams: Team[];
  managers: Profile[];
  assignments: TeamManager[];
}) {
  const company = actorRole === "company_admin";
  const names = new Map(
    managers.map((manager) => [manager.id, manager.full_name]),
  );
  return (
    <>
      <PageHeading
        title={company ? "Equipos y responsables" : "Mis equipos"}
        description={
          company
            ? "Organiza a las personas y asigna a quienes las acompañan."
            : "Los equipos bajo tu responsabilidad."
        }
      />
      {company ? (
        <details className="surface">
          <summary className="font-medium text-sm">
            Crear un nuevo equipo
          </summary>
          <div className="max-w-xl mt-5">
            <ActionForm action={saveTeamAction} submitLabel="Crear equipo">
              <input type="hidden" name="id" value="" />
              <TextField
                label="Nombre del equipo"
                name="name"
                required
                minLength={2}
                maxLength={100}
              />
            </ActionForm>
          </div>
        </details>
      ) : null}
      <div className="grid items-start gap-4 md:grid-cols-2">
        {teams.map((team) => (
          <Card key={team.id}>
            <CardHeader>
              <CardTitle>{team.name}</CardTitle>
              <CardDescription>
                {company
                  ? "Gestionar nombre y responsables."
                  : "Tienes permiso para administrar sus empleados."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6">
                {company ? (
                  <details>
                    <summary className="text-sm text-primary">
                      Editar nombre del equipo
                    </summary>
                    <div className="mt-4">
                      <ActionForm
                        action={saveTeamAction}
                        submitLabel="Guardar nombre"
                        submitVariant="outline"
                      >
                        <input type="hidden" name="id" value={team.id} />
                        <TextField
                          label="Nombre"
                          name="name"
                          defaultValue={team.name}
                          required
                          minLength={2}
                          maxLength={100}
                        />
                      </ActionForm>
                    </div>
                  </details>
                ) : null}
                {company ? (
                  <>
                    <ul className="flex flex-col gap-3">
                      {assignments
                        .filter((assignment) => assignment.team_id === team.id)
                        .map((assignment) => (
                          <li
                            key={assignment.profile_id}
                            className="flex flex-col gap-2"
                          >
                            <span className="text-sm">
                              {names.get(assignment.profile_id) ??
                                "Responsable"}
                            </span>
                            <ActionForm
                              action={setManagerAction}
                              submitLabel="Retirar responsable"
                              submitVariant="ghost"
                            >
                              <input
                                type="hidden"
                                name="team_id"
                                value={team.id}
                              />
                              <input
                                type="hidden"
                                name="profile_id"
                                value={assignment.profile_id}
                              />
                              <input
                                type="hidden"
                                name="assigned"
                                value="false"
                              />
                            </ActionForm>
                          </li>
                        ))}
                    </ul>
                    <details>
                      <summary className="text-sm text-primary">
                        Asignar un responsable
                      </summary>
                      <div className="mt-4">
                        <ActionForm
                          action={setManagerAction}
                          submitLabel="Asignar responsable"
                          disabled={managers.length === 0}
                        >
                          <input type="hidden" name="team_id" value={team.id} />
                          <input type="hidden" name="assigned" value="true" />
                          <SelectField
                            label="Responsable"
                            name="profile_id"
                            required
                            options={[
                              { value: "", label: "Selecciona un responsable" },
                              ...managers.map((manager) => ({
                                value: manager.id,
                                label: manager.full_name,
                              })),
                            ]}
                          />
                        </ActionForm>
                      </div>
                    </details>
                    {managers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Crea una cuenta con el rol «Administrador de equipo»
                        desde «Personas».
                      </p>
                    ) : null}
                  </>
                ) : (
                  <Link
                    href="/admin/users"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Gestionar empleados
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {teams.length === 0 ? (
        <section className="surface">
          <EmptyState
            icon={UsersRound}
            title={
              company
                ? "Todo empieza con un equipo"
                : "Sin equipos asignados todavía"
            }
            description={
              company
                ? "Abre «Crear un nuevo equipo» para empezar."
                : "La administración de empresa gestiona los equipos y sus responsables."
            }
          />
        </section>
      ) : null}
    </>
  );
}
