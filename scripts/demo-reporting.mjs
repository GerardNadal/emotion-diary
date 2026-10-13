import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { demoTeams, demoProfiles, demoEntries, demoEndDate } from "./demo-data.mjs";

const sqlLiteral = (s) => `'${String(s).replaceAll("'", "''")}'`;
// This SQL verifies exact deterministic fictional content inside PostgreSQL.
// It never retrieves diary rows or changes real-data baselines/publications.
export function demoReportingSql({ days = 180, endDate = demoEndDate() } = {}) {
  const profiles = demoProfiles().filter((p) => p.role === "employee");
  const roster = profiles.map((p, i) => `(${i + 1},${sqlLiteral(p.email)},${sqlLiteral(p.full_name)},${sqlLiteral(demoTeams.find((t) => t.key === p.team).name)},${p.active})`).join(",\n");
  // JSON array serialization matches jsonb::text (spaces between elements).
  // SHA-256 avoids sending thousands of long fictional reflections to the API.
  const records = profiles.map((profile, index) => {
    const entries = demoEntries(profile, { days, endDate }).toSorted((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const rows = entries.map(({ id, entry: e }) => {
      const values = [e.mood,e.emotion,e.intensity,e.reflection,e.category,e.reason,e.custom_reason,e.activity,e.reaction,e.support,new Date(e.occurred_at).toISOString().replace(/\.(\d{3})Z$/, ".$1000Z")];
      const canonical = `[${values.map((v) => JSON.stringify(v)).join(", ")}]`;
      return `${id}:${createHash("sha256").update(canonical).digest("base64")}`;
    }).join("\n");
    return `(${index+1},${entries.length},${sqlLiteral(createHash("sha256").update(rows).digest("base64"))})`;
  }).join(",\n");
  const from = new Date(Date.parse(`${endDate}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0,10);
  return `begin;
select pg_advisory_xact_lock(72419005);
create temporary table expected_demo_profiles(owner smallint primary key,email text unique,full_name text,team_name text,active boolean) on commit drop;
create temporary table expected_demo_entries(owner smallint primary key,entry_count integer,fingerprint text) on commit drop;
insert into expected_demo_profiles values ${roster};
insert into expected_demo_entries values ${records};
do $$ begin
  if exists(select 1 from expected_demo_profiles x left join public.profiles p on p.email=x.email left join public.teams t on t.id=p.team_id left join auth.users a on a.id=p.id
    where p.id is null or p.role<>'employee' or p.full_name<>x.full_name or p.active<>x.active or t.name is distinct from x.team_name or a.email is distinct from x.email) then
    raise exception 'El directorio no coincide exactamente con las identidades ficticias. No se habilita reporting demo.';
  end if;
  if exists(select 1 from public.profiles p join public.teams t on t.id=p.team_id where t.name in(select team_name from expected_demo_profiles)
    and not exists(select 1 from expected_demo_profiles x where x.email=p.email and x.team_name=t.name)) then
    raise exception 'Un equipo demo contiene miembros ajenos a los fixtures. No se habilita reporting demo.';
  end if;
  if exists(with actual as (
    select r.owner,count(e.id) entry_count,encode(sha256(convert_to(coalesce(string_agg(e.id::text||':'||encode(sha256(convert_to(jsonb_build_array(e.mood,e.emotion,e.intensity,e.reflection,e.category,e.reason,e.custom_reason,e.activity,e.reaction,e.support,to_char(e.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))::text,'UTF8')),'base64'),E'\\n' order by e.id) filter(where e.id is not null),''),'UTF8')),'base64') fingerprint
    from expected_demo_profiles r join public.profiles p on p.email=r.email left join journal_private.entries e on e.user_id=p.id group by r.owner
  ) select 1 from actual a join expected_demo_entries x using(owner) where a.entry_count<>x.entry_count or a.fingerprint<>x.fingerprint) then
    raise exception 'Los diarios no coinciden exactamente con el generador ficticio (hay entradas distintas, adicionales o ausentes). No se sobrescribirá contenido ni se habilitará reporting demo.';
  end if;
end $$;
insert into reporting.demo_provenance(team_id,generation,valid_from,valid_until)
select t.id,s.generation,${sqlLiteral(from)}::date::timestamp at time zone 'Europe/Madrid',(${sqlLiteral(endDate)}::date+1)::timestamp at time zone 'Europe/Madrid'
from expected_demo_profiles x join public.teams t on t.name=x.team_name join reporting.team_state s on s.team_id=t.id
group by t.id,s.generation
on conflict(team_id) do update set generation=excluded.generation,valid_from=excluded.valid_from,valid_until=excluded.valid_until,attested_at=clock_timestamp();
commit;
select 'PASS: procedencia ficticia validada; reporting demo habilitado sin cambiar la política de datos reales' result;
`;
}

export async function attestDemoReporting(options = {}) {
  const hostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  if (!local && !process.argv.includes("--allow-remote")) throw new Error("Operación remota bloqueada. Usa --allow-remote únicamente para la demo.");
  if (!local) {
    const linked = (await readFile("supabase/.temp/project-ref", "utf8")).trim();
    if (hostname !== `${linked}.supabase.co`) throw new Error("El Supabase vinculado no coincide con la URL de la aplicación.");
  }
  await mkdir("supabase/.temp", { recursive: true });
  await writeFile("supabase/.temp/reporting-demo-attestation.sql", demoReportingSql(options));
  // Fixed command text only, compatible with Windows' installed CLI shims.
  const target = local ? "--local" : "--linked";
  const result = process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", local
      ? "supabase db query --local --file supabase/.temp/reporting-demo-attestation.sql"
      : "supabase db query --linked --file supabase/.temp/reporting-demo-attestation.sql"], { encoding: "utf8" })
    : spawnSync("supabase", ["db", "query", target, "--file", "supabase/.temp/reporting-demo-attestation.sql"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    // Only a validation error/CLI diagnostic, never row contents or credentials.
    throw new Error([result.stderr?.trim(), result.stdout?.trim()].filter(Boolean).join("\n").slice(0,2000) || "No se ha podido validar la procedencia de la demo.");
  }
  console.log("Reporting demo habilitado: directorio y diarios verificados contra los fixtures. Los gráficos se identifican como datos ficticios.");
}

async function main() {
  try {
    const days = Number(process.env.DEMO_DAYS ?? 180);
    if (process.argv.includes("--dry-run")) { demoReportingSql({ days }); console.log("Validación demo preparada. No se han consultado ni modificado datos."); }
    else await attestDemoReporting({ days });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
