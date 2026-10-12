import { getDirectory } from "@/modules/administration/queries";
import { TeamManagement } from "@/modules/administration/teams";
export default async function TeamsPage() {
  const { actor, teams, managers, assignments } = await getDirectory();
  return (
    <TeamManagement
      actorRole={actor.role}
      teams={teams}
      managers={managers}
      assignments={assignments}
    />
  );
}
