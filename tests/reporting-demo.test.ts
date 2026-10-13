import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { demoProfiles, demoTeams, demoEntries } from "../scripts/demo-data.mjs";
import { demoReportingSql } from "../scripts/demo-reporting.mjs";
import { collectiveDashboard } from "../src/modules/administration/reporting-model";

test("only exact synthetic fixtures can publish demo history; changes revoke provenance and real protections remain", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to anon,authenticated,service_role;`);
    const dir = new URL("../supabase/migrations/", import.meta.url);
    for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(file, dir), "utf8"));
    await db.exec("alter table journal_private.entries disable trigger journal_meaningful_activity");
    const id = (n: number) => `f7100000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    const teamIds = new Map<string, string>();
    for (const [index, team] of demoTeams.entries()) {
      teamIds.set(team.key, id(100 + index));
      await db.query("insert into public.teams(id,name) values($1,$2)", [id(100 + index), team.name]);
    }
    const profiles = demoProfiles().filter((p: { role: string }) => p.role === "employee");
    const options = { days: 45, endDate: "2026-10-12" };
    for (const [index, p] of profiles.entries()) {
      await db.query("insert into auth.users values($1,$2)", [id(index + 1), p.email]);
      await db.query("insert into public.profiles(id,email,full_name,role,team_id,active) values($1,$2,$3,'employee',$4,$5)", [id(index + 1), p.email, p.full_name, teamIds.get(p.team!), p.active]);
      for (const e of demoEntries(p, options)) {
        await db.query(`insert into journal_private.entries(id,user_id,mood,emotion,intensity,reflection,category,reason,custom_reason,activity,reaction,support,occurred_at)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [e.id, id(index + 1), e.entry.mood, e.entry.emotion, e.entry.intensity, e.entry.reflection, e.entry.category, e.entry.reason, e.entry.custom_reason, e.entry.activity, e.entry.reaction, e.entry.support, e.entry.occurred_at]);
      }
    }
    await db.query("insert into auth.users values($1,'demo-qa-company@example.test')", [id(90)]);
    await db.query("insert into public.profiles(id,email,full_name,role) values($1,'demo-qa-company@example.test','QA empresa','company_admin')", [id(90)]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id(90)]);
    const team = teamIds.get("desarrollo")!;
    async function dashboard() {
      return (await db.query<{ result: unknown }>("select public.collective_statistics($1,'2026-09-01','month') result", [team])).rows[0].result;
    }
    const before = collectiveDashboard.parse(await dashboard());
    assert.equal(before.current.status, "insufficient_data");
    await db.exec(demoReportingSql(options));
    await db.exec("set role authenticated");
    const result = collectiveDashboard.parse(await dashboard());
    assert.equal(result.current.status, "published");
    if (result.current.status === "published") {
      assert.equal(result.current.source, "demo");
      assert.equal(result.current.dimensions.mood.status, "published");
      assert.equal(result.current.dimensions.emotion.status, "published");
      assert.equal(result.current.participation.status, "published");
    }
    await assert.rejects(db.query("insert into reporting.demo_provenance values($1,1,now()-interval '1 year',now(),now())", [team]), (e: unknown) => (e as { code: string }).code === "42501");
    await db.exec("reset role");
    // A genuine addition in another month must block use of the demo certificate.
    await db.query("insert into journal_private.entries(id,user_id,mood,emotion,intensity,occurred_at) values($1,$2,'low','sadness',4,'2026-10-12T12:30:00Z')", [id(200), id(1)]);
    assert.equal(collectiveDashboard.parse(await dashboard()).current.status, "insufficient_data");
    await assert.rejects(db.exec(demoReportingSql(options)), /no coinciden exactamente/i);
    await db.exec("rollback");
    await db.query("delete from journal_private.entries where id=$1", [id(200)]);
    await db.exec(demoReportingSql(options));
    assert.equal(collectiveDashboard.parse(await dashboard()).current.status, "published");
    // Editing historical values cannot yield a second numeric publication.
    await db.query("update journal_private.entries set mood=case when mood='neutral' then 'low' else 'neutral' end where id=$1", [demoEntries(profiles[0], options).find((e: { entry: { occurred_at: string } }) => e.entry.occurred_at.startsWith("2026-09"))!.id]);
    assert.equal(collectiveDashboard.parse(await dashboard()).current.status, "insufficient_data");
    await assert.rejects(db.exec(demoReportingSql(options)), /no coinciden exactamente/i);
    await db.exec("rollback");
    // A team whose name starts with Demo still has no provenance by default.
    await db.query("insert into public.teams(id,name) values($1,'Demo · Real sin certificado')", [id(300)]);
    assert.deepEqual((await db.query("select * from reporting.demo_provenance where team_id=$1", [id(300)])).rows, []);
  } finally { await db.close(); }
});
