import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ActionForm } from "@/components/forms/action-form";
import { TextField, SelectField } from "@/components/forms/inputs";
import { getDirectory } from "@/modules/administration/queries";
import { saveTeamAction, setManagerAction } from "@/modules/administration/actions";
export default async function TeamsPage() {
  const { actor, teams, managers, assignments } = await getDirectory();
  const company = actor.role === "company_admin";
  const names = new Map(managers.map((manager) => [manager.id, manager.full_name]));
  return <><h1 className="text-2xl font-semibold">{company ? "Equipos y responsables" : "Mis equipos"}</h1>
    <p className="text-muted-foreground">{company ? "Crea equipos y asigna uno o varios responsables a cada uno." : "La administración de empresa gestiona equipos y responsables."}</p>
    {company ? <Card className="max-w-xl"><CardHeader><CardTitle>Crear equipo</CardTitle><CardDescription>Después podrás asignar empleados y responsables.</CardDescription></CardHeader>
      <CardContent><ActionForm action={saveTeamAction} submitLabel="Crear equipo"><input type="hidden" name="id" value="" />
        <TextField label="Nombre del equipo" name="name" required minLength={2} maxLength={100} /></ActionForm></CardContent></Card> : null}
    <div className="grid items-start gap-4 md:grid-cols-2">{teams.map((team) => <Card key={team.id}>
      <CardHeader><CardTitle>{team.name}</CardTitle><CardDescription>{company ? "Gestionar nombre y responsables." : "Tienes permiso para administrar sus empleados."}</CardDescription></CardHeader>
      <CardContent><div className="flex flex-col gap-6">
        {company ? <ActionForm action={saveTeamAction} submitLabel="Guardar nombre">
          <input type="hidden" name="id" value={team.id} /><TextField label="Nombre" name="name" defaultValue={team.name} required minLength={2} maxLength={100} />
        </ActionForm> : null}
        {company ? <>
          <ul className="flex flex-col gap-3">{assignments.filter((assignment) => assignment.team_id === team.id).map((assignment) => <li key={assignment.profile_id} className="flex flex-col gap-2">
            <span className="text-sm">{names.get(assignment.profile_id) ?? "Responsable"}</span>
            <ActionForm action={setManagerAction} submitLabel="Retirar responsable">
              <input type="hidden" name="team_id" value={team.id} /><input type="hidden" name="profile_id" value={assignment.profile_id} /><input type="hidden" name="assigned" value="false" />
            </ActionForm></li>)}</ul>
          <ActionForm action={setManagerAction} submitLabel="Asignar responsable" disabled={managers.length === 0}>
            <input type="hidden" name="team_id" value={team.id} /><input type="hidden" name="assigned" value="true" />
            <SelectField label="Responsable" name="profile_id" required options={[{ value: "", label: "Selecciona un responsable" }, ...managers.map((manager) => ({ value: manager.id, label: manager.full_name }))]} />
          </ActionForm>
          {managers.length === 0 ? <p className="text-sm text-muted-foreground">Crea una cuenta con el rol «Administrador de equipo» desde «Personas».</p> : null}
        </> : null}
      </div></CardContent></Card>)}</div>
    {teams.length === 0 ? <p>No tienes equipos asignados todavía.</p> : null}
  </>;
}
