// Phase-1 schema contract. Regenerate with `npm run db:types` after migrating.
export type AppRole = "company_admin" | "team_admin" | "employee";
export type Profile = {
  id: string; email: string; full_name: string; role: AppRole;
  team_id: string | null; active: boolean; created_at: string; updated_at: string;
};
export type Team = { id: string; name: string; created_at: string; updated_at: string };
export type TeamManager = { team_id: string; profile_id: string; created_at: string };
type Table<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: [] };
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, Pick<Profile, "id" | "email" | "full_name" | "role"> & Partial<Profile>>;
      teams: Table<Team, Pick<Team, "name"> & Partial<Team>>;
      team_managers: Table<TeamManager, Pick<TeamManager, "team_id" | "profile_id"> & Partial<TeamManager>>;
    };
    Views: Record<string, never>;
    Functions: {
      save_profile: { Args: { p_id: string; p_full_name: string; p_role: AppRole; p_team_id: string | null; p_active: boolean }; Returns: string };
      save_team: { Args: { p_id: string | null; p_name: string }; Returns: string };
      set_team_manager: { Args: { p_team_id: string; p_profile_id: string; p_assigned: boolean }; Returns: undefined };
      bootstrap_admin: { Args: { p_id: string; p_full_name: string }; Returns: string };
    };
    Enums: { app_role: AppRole };
    CompositeTypes: Record<string, never>;
  };
};
