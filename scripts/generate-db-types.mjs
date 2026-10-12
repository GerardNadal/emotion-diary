import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
// Buffer first: a CLI error must never truncate the working contract.
const result = spawnSync(process.platform === "win32" ? "supabase.cmd" : "supabase", ["gen", "types", "typescript", "--local", "--schema", "public"], {
  encoding: "utf8", shell: process.platform === "win32",
});
if (result.error || result.status !== 0 || !result.stdout.includes("export type Database")) {
  console.error("No se pudieron generar los tipos. Arranca Supabase local y comprueba que la CLI está en PATH.");
  process.exitCode = 1;
} else {
  const aliases = `\nexport type AppRole = Database["public"]["Enums"]["app_role"];\nexport type Profile = Database["public"]["Tables"]["profiles"]["Row"];\nexport type Team = Database["public"]["Tables"]["teams"]["Row"];\nexport type TeamManager = Database["public"]["Tables"]["team_managers"]["Row"];\n`;
  writeFileSync("src/lib/supabase/database.types.ts", result.stdout + aliases);
  console.log("Tipos regenerados.");
}
