"use client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/inputs";
import { FieldDescription } from "@/components/ui/field";
import type { AppRole, Profile, Team } from "@/lib/supabase/database.types";
import { roleLabels } from "@/modules/auth/roles";
import { saveProfileAction } from "./actions";

export function ProfileForm({ profile, teams, actorRole }: { profile?: Profile; teams: Team[]; actorRole: AppRole }) {
  const [role, setRole] = useState<AppRole>(profile?.role ?? "employee");
  return <ActionForm action={saveProfileAction} submitLabel={profile ? "Guardar usuario" : "Crear usuario"}>
    <input type="hidden" name="id" value={profile?.id ?? ""} />
    <TextField label="Nombre y apellidos" name="full_name" defaultValue={profile?.full_name} required minLength={2} maxLength={100} autoComplete="name" />
    <TextField label="Correo de acceso" name="email" type="email" defaultValue={profile?.email} readOnly={Boolean(profile)} required maxLength={254} autoComplete="email" />
    {actorRole === "company_admin" ? <SelectField label="Rol" name="role" value={role}
      onChange={(event) => setRole(event.target.value as AppRole)}
      options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))} />
      : <input type="hidden" name="role" value="employee" />}
    {role === "employee" ? <SelectField label="Equipo" name="team_id" defaultValue={profile?.team_id ?? ""} required
      options={[{ value: "", label: "Selecciona un equipo" }, ...teams.map((team) => ({ value: team.id, label: team.name }))]} />
      : <><input type="hidden" name="team_id" value="" /><FieldDescription>Los responsables se asignan a sus equipos desde «Equipos».</FieldDescription></>}
    {profile ? <SelectField label="Estado" name="active" defaultValue={String(profile.active)}
      options={[{ value: "true", label: "Activo" }, { value: "false", label: "Desactivado" }]} />
      : <><input type="hidden" name="active" value="true" /><FieldDescription>La cuenta se crea sin compartir contraseñas. El usuario establece la suya mediante «Recuperar acceso».</FieldDescription></>}
  </ActionForm>;
}
