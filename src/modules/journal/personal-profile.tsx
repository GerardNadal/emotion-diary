import Link from "next/link";
import { KeyRound } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { buttonVariants } from "@/components/ui/button";
import { roleLabels } from "@/modules/auth/roles";
import type { Profile } from "@/lib/supabase/database.types";

export function PersonalProfile({
  profile,
  teamName,
}: {
  profile: Pick<Profile, "full_name" | "email" | "role">;
  teamName: string;
}) {
  const initials = profile.full_name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
  return (
    <>
      <PageHeading
        title="Mi perfil"
      />
      <section className="surface profile-surface">
        <div className="profile-heading">
          <span className="initials" aria-hidden="true">
            {initials}
          </span>
          <div>
            <h2>{profile.full_name}</h2>
            <p>{roleLabels[profile.role]}</p>
          </div>
        </div>
        <dl className="profile-data">
          <div>
            <dt>Correo de acceso</dt>
            <dd>{profile.email}</dd>
          </div>
          <div>
            <dt>Equipo</dt>
            <dd>{teamName}</dd>
          </div>
          <div>
            <dt>Estado de la cuenta</dt>
            <dd>Activa</dd>
          </div>
          <div>
            <dt>Gestión de datos de cuenta</dt>
            <dd>A través de la administración</dd>
          </div>
        </dl>
        <Link
          href="/update-password"
          className={buttonVariants({ variant: "outline" })}
        >
          <KeyRound data-icon="inline-start" />
          Cambiar contraseña
        </Link>
      </section>
    </>
  );
}
