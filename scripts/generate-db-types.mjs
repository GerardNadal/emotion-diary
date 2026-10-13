import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
// Buffer first: a CLI error must never truncate the working contract.
const target = process.argv.includes("--linked") ? "--linked" : "--local";
const args = [
  "gen",
  "types",
  "--lang",
  "typescript",
  target,
  "--schema",
  "public",
];
const result =
  process.platform === "win32"
    ? // Fixed arguments only. Avoid deprecated shell concatenation and support both
      // native Supabase executables and npm/scoop command shims in PATH.
      spawnSync("cmd.exe", ["/d", "/s", "/c", `supabase ${args.join(" ")}`], {
        encoding: "utf8",
      })
    : spawnSync("supabase", args, { encoding: "utf8" });
if (
  result.error ||
  result.status !== 0 ||
  !result.stdout.includes("export type Database")
) {
  console.error(
    "No se pudieron generar los tipos. Comprueba Supabase local o el enlace remoto y la CLI en PATH.",
  );
  process.exitCode = 1;
} else {
  const aliases = `\nexport type AppRole = Database["public"]["Enums"]["app_role"];\nexport type Profile = Database["public"]["Tables"]["profiles"]["Row"];\nexport type Team = Database["public"]["Tables"]["teams"]["Row"];\nexport type TeamManager = Database["public"]["Tables"]["team_managers"]["Row"];\n`;
  writeFileSync("src/lib/supabase/database.types.ts", result.stdout + aliases);
  console.log("Tipos regenerados.");
}
