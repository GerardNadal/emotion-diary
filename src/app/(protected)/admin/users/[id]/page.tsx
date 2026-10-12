import { notFound } from "next/navigation";
import { z } from "zod";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  getDirectory,
  getProfileForEdit,
} from "@/modules/administration/queries";
import { ProfileForm } from "@/modules/administration/profile-form";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { buttonVariants } from "@/components/ui/button";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [profile, { teams, actor }] = await Promise.all([
    getProfileForEdit(id),
    getDirectory(),
  ]);
  if (!profile || (actor.role === "team_admin" && profile.role !== "employee"))
    notFound();
  return (
    <>
      <PageHeading
        title="Editar cuenta"
        description={profile.full_name}
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
            <CardTitle>Datos y acceso</CardTitle>
            <CardDescription>
              Puedes cambiar su nombre, asignación y estado. Solo la
              administración de empresa puede cambiar roles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              profile={profile}
              teams={teams}
              actorRole={actor.role}
            />
          </CardContent>
        </Card>
        <aside className="form-aside">
          <ShieldCheck aria-hidden="true" />
          <h2>El acceso bajo control</h2>
          <p>
            Al desactivar una cuenta, la persona perderá acceso en su siguiente
            solicitud. Su identidad se conserva.
          </p>
          <p>El correo de acceso se mantiene para proteger sus credenciales.</p>
        </aside>
      </div>
    </>
  );
}
