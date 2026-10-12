import { notFound } from "next/navigation";
import { z } from "zod";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getDirectory, getProfileForEdit } from "@/modules/administration/queries";
import { ProfileForm } from "@/modules/administration/profile-form";
export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [profile, { teams, actor }] = await Promise.all([getProfileForEdit(id), getDirectory()]);
  if (!profile || (actor.role === "team_admin" && profile.role !== "employee")) notFound();
  return <Card className="max-w-xl"><CardHeader><CardTitle>Editar usuario</CardTitle>
    <CardDescription>Puedes cambiar su nombre, asignación y estado. Solo la administración de empresa puede cambiar roles.</CardDescription></CardHeader>
    <CardContent><ProfileForm profile={profile} teams={teams} actorRole={actor.role} /></CardContent></Card>;
}
