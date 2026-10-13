import type { Database as GeneratedDatabase } from "./database.types";
type PublicSchema = GeneratedDatabase["public"];
type Functions = PublicSchema["Functions"];

// PostgreSQL allows NULL function arguments; generated RPC types do not always
// represent that. Preserve intentional NULLs after regeneration:
// new team => NULL id; administrator => NULL employee team;
// company reporting => NULL selected team.
export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<PublicSchema, "Functions"> & {
    Functions: Omit<Functions, "save_team" | "save_profile" | "collective_statistics"> & {
      collective_statistics: {
        Args: { p_team_id: string | null; p_period: string; p_grain?: string };
        Returns: import("./database.types").Json;
      };
      save_team: Omit<Functions["save_team"], "Args"> & {
        Args: Omit<Functions["save_team"]["Args"], "p_id"> & { p_id: string | null };
      };
      save_profile: Omit<Functions["save_profile"], "Args"> & {
        Args: Omit<Functions["save_profile"]["Args"], "p_team_id"> & { p_team_id: string | null };
      };
    };
  };
};
