"use client";
import { useState } from "react";
import Link from "next/link";
import { LayoutGrid, List, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { EmptyState } from "@/components/empty-state";
import { roleLabels } from "@/modules/auth/roles";
import type { Profile, AppRole } from "@/lib/supabase/database.types";

export function Directory({
  profiles,
  teams,
  actorRole,
}: {
  profiles: Profile[];
  teams: { id: string; name: string }[];
  actorRole: AppRole;
}) {
  const [view, setView] = useState("table");
  const [search, setSearch] = useState("");
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const visible = profiles.filter((profile) =>
    `${profile.full_name} ${profile.email} ${teamNames.get(profile.team_id ?? "") ?? ""}`
      .toLocaleLowerCase("es")
      .includes(search.toLocaleLowerCase("es")),
  );
  const canEdit = (profile: Profile) =>
    actorRole === "company_admin" || profile.role === "employee";
  function person(profile: Profile) {
    return (
      <div className="person-cell">
        <span className="initials" aria-hidden="true">
          {profile.full_name
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0])
            .join("")}
        </span>
        <div>
          <strong>{profile.full_name}</strong>
          <small>{profile.email}</small>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="view-toolbar">
        <Field className="max-w-sm">
          <FieldLabel htmlFor="directory-search" className="sr-only">
            Buscar en esta página
          </FieldLabel>
          <Input
            id="directory-search"
            placeholder="Buscar en esta página…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            type="search"
          />
        </Field>
        <ToggleGroup
          value={[view]}
          onValueChange={(values) => {
            if (values[0]) setView(values[0]);
          }}
          aria-label="Vista del directorio"
        >
          <ToggleGroupItem value="table">
            <List aria-hidden="true" />
            Tabla
          </ToggleGroupItem>
          <ToggleGroupItem value="cards">
            <LayoutGrid aria-hidden="true" />
            Tarjetas
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {!visible.length ? (
        <section className="surface">
          <EmptyState
            icon={UsersRound}
            title={
              search
                ? "Sin coincidencias en esta página"
                : "Todavía no hay personas para mostrar"
            }
            description={
              search
                ? "Prueba con otro nombre, correo o equipo. La búsqueda se aplica a la página actual."
                : "Las cuentas autorizadas aparecerán aquí cuando se creen."
            }
          />
        </section>
      ) : view === "table" ? (
        <section className="table-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>{person(profile)}</TableCell>
                  <TableCell>{roleLabels[profile.role]}</TableCell>
                  <TableCell>
                    {profile.team_id
                      ? (teamNames.get(profile.team_id) ??
                        "Equipo no disponible")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={profile.active ? "secondary" : "outline"}>
                      {profile.active ? "Activo" : "Desactivado"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canEdit(profile) ? (
                      <Link
                        href={`/admin/users/${profile.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                        aria-label={`Editar ${profile.full_name}`}
                      >
                        Editar
                      </Link>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : (
        <div className="directory-cards">
          {visible.map((profile) => (
            <article className="surface directory-card" key={profile.id}>
              {person(profile)}
              <dl>
                <div>
                  <dt>Rol</dt>
                  <dd>{roleLabels[profile.role]}</dd>
                </div>
                <div>
                  <dt>Equipo</dt>
                  <dd>
                    {profile.team_id
                      ? (teamNames.get(profile.team_id) ??
                        "Equipo no disponible")
                      : "—"}
                  </dd>
                </div>
              </dl>
              <Badge variant={profile.active ? "secondary" : "outline"}>
                {profile.active ? "Activo" : "Desactivado"}
              </Badge>
              {canEdit(profile) ? (
                <Link
                  href={`/admin/users/${profile.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                  aria-label={`Editar ${profile.full_name}`}
                >
                  Editar
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
