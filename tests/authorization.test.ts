import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Real PostgreSQL engine; only Supabase Auth's roles, users and uid() are mocked.
// This does not replace a live Auth/SMTP integration test.
test("phase-1 migration and authorization boundaries", async (t) => {
  const db = new PGlite();
  const ids = Array.from({ length: 9 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);
  const [company, manager, employeeA, employeeB, inactive, orphan, company2, manager2, newEmployee] = ids;
  const teamA = "10000000-0000-4000-8000-000000000001";
  const teamB = "10000000-0000-4000-8000-000000000002";
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth, public to authenticated, anon, service_role;
    grant execute on function auth.uid() to authenticated, anon, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(migrations)).filter((file) => file.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(file, migrations), "utf8"));
  }
  for (const [i, id] of ids.entries()) await db.query("insert into auth.users values($1,$2)", [id, `user${i}@example.test`]);
  async function actor(id: string | null, role = "authenticated") {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
    await db.exec(`set role ${role}`);
  }
  async function rows(query: string, args?: unknown[]) { return (await db.query<Record<string, unknown>>(query, args)).rows; }
  async function deny(query: string, args?: unknown[]) {
    await assert.rejects(db.query(query, args), (error: unknown) => {
      assert.equal((error as { code: string }).code, "42501"); return true;
    });
  }
  async function save(id: string, role = "employee", team: string | null = teamA, active = true) {
    return db.query("select public.save_profile($1, $2, $3::public.app_role, $4, $5)", [id, "Demo User", role, team, active]);
  }
  try {
    await t.test("only service role can bootstrap, exactly once", async () => {
      await actor(orphan);
      await deny("select public.bootstrap_admin($1,'Initial Admin')", [company]);
      await actor(null, "service_role");
      await db.query("select public.bootstrap_admin($1,'Initial Admin')", [company]);
      await deny("select public.bootstrap_admin($1,'Other Admin')", [company2]);
    });
    await db.exec("reset role");
    await db.query("insert into public.teams(id,name) values($1,'Alpha'),($2,'Beta')", [teamA, teamB]);
    await actor(company);
    await save(manager, "team_admin", null);
    await save(manager2, "team_admin", null);
    await save(company2, "company_admin", null);
    await save(employeeA);
    await save(employeeB, "employee", teamB);
    await save(inactive, "employee", teamA, false);
    await db.query("select public.set_team_manager($1,$2,true)", [teamA, manager]);

    await t.test("company reads the entire directory and creates teams", async () => {
      assert.equal((await rows("select * from public.profiles")).length, 7);
      await db.query("select public.save_team(null,'Gamma')");
      assert.equal((await rows("select * from public.teams")).length, 3);
    });
    await t.test("team admin only reads own profile, scoped employees and teams", async () => {
      await actor(manager);
      assert.deepEqual((await rows("select id from public.profiles order by id")).map((r) => r.id), [manager, employeeA, inactive].sort());
      assert.deepEqual(await rows("select id from public.teams"), [{ id: teamA }]);
      assert.equal((await rows("select * from public.team_managers")).length, 1);
    });
    await t.test("team admin can create, edit and deactivate scoped employees", async () => {
      await save(newEmployee);
      await save(employeeA, "employee", teamA, false);
      assert.equal((await rows("select active from public.profiles where id=$1", [employeeA]))[0].active, false);
      await save(employeeA);
    });
    await t.test("team admin cannot move employees into or out of an unauthorized team", async () => {
      await deny("select public.save_profile($1,'Move out','employee',$2,true)", [employeeA, teamB]);
      await deny("select public.save_profile($1,'Move in','employee',$2,true)", [employeeB, teamA]);
    });
    await t.test("team admin cannot escalate roles, edit another admin, or assign managers", async () => {
      await deny("select public.save_profile($1,'Escalation','company_admin',null,true)", [employeeA]);
      await deny("select public.save_profile($1,'Admin edit','employee',$2,true)", [company2, teamA]);
      await deny("select public.set_team_manager($1,$2,true)", [teamB, manager]);
      await deny("select public.save_team(null,'Unauthorized')");
    });
    await t.test("employee sees own profile and own team only", async () => {
      await actor(employeeA);
      assert.deepEqual(await rows("select id from public.profiles"), [{ id: employeeA }]);
      assert.deepEqual(await rows("select id from public.teams"), [{ id: teamA }]);
      assert.deepEqual(await rows("select * from public.team_managers"), []);
      await deny("select public.save_profile($1,'Tamper','employee',$2,true)", [employeeA, teamA]);
    });
    await t.test("direct table writes cannot bypass RPC permission checks", async () => {
      await deny("update public.profiles set role='company_admin',team_id=null where id=$1", [employeeA]);
      await deny("insert into public.teams(name) values('Bypass')");
      await deny("delete from public.team_managers");
      await actor(company);
      await deny("update public.profiles set active=false where id=$1", [company]);
    });
    await t.test("inactive and unprovisioned Auth accounts have no directory access", async () => {
      for (const id of [inactive, orphan]) {
        await actor(id);
        assert.deepEqual(await rows("select * from public.profiles"), []);
        assert.deepEqual(await rows("select * from public.teams"), []);
        await deny("select public.save_team(null,'Denied')");
      }
    });
    await t.test("unassigned team admin has no employees or teams", async () => {
      await actor(manager2);
      assert.deepEqual(await rows("select id from public.profiles"), [{ id: manager2 }]);
      assert.deepEqual(await rows("select * from public.teams"), []);
      await deny("select public.save_profile($1,'Denied','employee',$2,true)", [orphan, teamA]);
    });
    await t.test("a manager can transfer between two teams it owns", async () => {
      await actor(company);
      await db.query("select public.set_team_manager($1,$2,true)", [teamB, manager]);
      await actor(manager);
      await save(employeeA, "employee", teamB);
      await save(employeeA, "employee", teamA);
      await actor(company);
      await db.query("select public.set_team_manager($1,$2,false)", [teamB, manager]);
    });
    await t.test("removing assignments takes effect without a token refresh", async () => {
      await actor(company);
      await db.query("select public.set_team_manager($1,$2,false)", [teamA, manager]);
      await actor(manager);
      assert.deepEqual(await rows("select * from public.teams"), []);
      await deny("select public.save_profile($1,'Denied','employee',$2,true)", [employeeA, teamA]);
      await actor(company);
      await db.query("select public.set_team_manager($1,$2,true)", [teamA, manager]);
    });
    await t.test("deactivation removes assignments and blocks existing JWTs", async () => {
      await save(manager, "team_admin", null, false);
      await actor(manager);
      assert.deepEqual(await rows("select * from public.profiles"), []);
      await deny("select public.save_team(null,'Denied')");
      await actor(company);
      assert.equal((await rows("select * from public.team_managers where profile_id=$1", [manager])).length, 0);
    });
    await t.test("company admin can transfer and change roles, but cannot demote/deactivate itself", async () => {
      await save(employeeB, "employee", teamA);
      await save(manager, "employee", teamA);
      await deny("select public.save_profile($1,'Self','employee',$2,true)", [company, teamA]);
      await deny("select public.save_profile($1,'Self','company_admin',null,false)", [company]);
    });
    await t.test("employee membership and manager role invariants are enforced", async () => {
      await assert.rejects(save(employeeB, "employee", null), (e: unknown) => (e as { code: string }).code === "23514");
      await assert.rejects(db.query("select public.set_team_manager($1,$2,true)", [teamB, employeeB]), (e: unknown) => (e as { code: string }).code === "22023");
    });
    await t.test("anonymous users cannot read tables or call public mutation endpoints", async () => {
      await actor(null, "anon");
      await deny("select * from public.profiles");
      await deny("select * from public.teams");
      await deny("select public.save_team(null,'Denied')");
      await deny("select public.bootstrap_admin($1,'Denied')", [orphan]);
    });
    await t.test("reserved privacy schemas and audit logs are inaccessible to every application role", async () => {
      for (const id of [company, manager, employeeA]) {
        await actor(id);
        await deny("select * from app_private.admin_audit");
        assert.deepEqual(await rows("select has_schema_privilege(current_user,'journal_private','usage') as journal, has_schema_privilege(current_user,'reporting','usage') as reporting"), [{ journal: false, reporting: false }]);
      }
      await db.exec("reset role");
      const functions = await rows("select proname from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and prosecdef");
      assert.deepEqual(functions, []);
      assert.ok((await rows("select * from app_private.admin_audit")).length > 0);
    });
  } finally { await db.close(); }
});
