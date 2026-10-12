import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { getDirectory } from "@/modules/administration/queries";
import { ProfileForm } from "@/modules/administration/profile-form";
import Link from "next/link";
import { LockKeyhole, ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { buttonVariants } from "@/components/ui/button";

export default async function NewUserPage() {
  const { teams, actor } = await getDirectory();
  return (
    <>
      <PageHeading
        title="Una nueva persona"
        description="Prepara su acceso y dale un lugar en el equipo."
        action={
          <Link
            href="/admin/users"
            className={buttonVariants({ variant: "ghost" })}
          >
            <ArrowLeft data-icon="inline-start" />
            Volver a personas
          </Link>
        }
      />
      <div className="admin-form-grid">
        <Card>
          <CardHeader>
            <CardTitle>Datos de la cuenta</CardTitle>
            <CardDescription>
              Los empleados pertenecen a un único equipo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm teams={teams} actorRole={actor.role} />
          </CardContent>
        </Card>
        <aside className="form-aside">
          <LockKeyhole aria-hidden="true" />
          <h2>Un acceso personal y seguro</h2>
          <p>
            La persona establecerá su contraseña desde «Recuperar acceso». No es
            necesario compartir credenciales.
          </p>
          <p>
            Los permisos administrativos nunca dan acceso a diarios
            individuales.
          </p>
        </aside>
      </div>
    </>
  );
}
