import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { reasonGroups } from "../src/modules/journal/emotions";

test("phase-3/4/5/6 PostgreSQL migrations, private/collective aggregates, AI limits, activity and authorization (Auth claims emulated)", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth; create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth, public to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;`);
    const dir = new URL("../supabase/migrations/", import.meta.url);
    for (const file of (await readdir(dir))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(new URL(file, dir), "utf8"));
    // Hosted Supabase does not allow granting its managed auth schema.
    // Journal RPCs must use the existing identity-only bridge.
    await db.exec("revoke usage on schema auth from emotion_journal_executor");
    const catalog = (
      await db.query<{ category: string; reason: string }>(
        "select * from journal_private.reason_catalog order by category,reason",
      )
    ).rows;
    assert.deepEqual(
      catalog,
      reasonGroups
        .flatMap((g) =>
          g.reasons.map((r) => ({ category: g.value, reason: r.value })),
        )
        .sort(
          (a, b) =>
            a.category.localeCompare(b.category) ||
            a.reason.localeCompare(b.reason),
        ),
    );
    await db.exec(
      await readFile(
        new URL("../supabase/tests/journal.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(await readFile(new URL("../supabase/tests/evolution.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/tests/workweek.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/tests/reporting.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/tests/ai.sql", import.meta.url), "utf8"));
  } finally {
    await db.close();
  }
});
