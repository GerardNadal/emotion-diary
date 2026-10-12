import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getDirectory } from "@/modules/administration/queries";
import { ProfileForm } from "@/modules/administration/profile-form";
export default async function NewUserPage() {
  const { teams, actor } = await getDirectory();
  return <Card className="max-w-xl"><CardHeader><CardTitle>Crear usuario</CardTitle>
    <CardDescription>Los empleados pertenecen a un único equipo.</CardDescription></CardHeader>
    <CardContent><ProfileForm teams={teams} actorRole={actor.role} /></CardContent></Card>;
}
