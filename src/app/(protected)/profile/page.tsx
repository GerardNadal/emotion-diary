import { PersonalProfile } from "@/modules/journal/personal-profile";
import { requireProfile } from "@/modules/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const profile = await requireProfile();
  let teamName = "No aplica a este rol";
  if (profile.team_id) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("teams")
      .select("name")
      .eq("id", profile.team_id)
      .maybeSingle();
    if (error) throw new Error("No se ha podido consultar tu equipo.");
    teamName = data?.name ?? "Equipo no disponible";
  }
  return (
    <PersonalProfile
      profile={{
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
      }}
      teamName={teamName}
    />
  );
}
