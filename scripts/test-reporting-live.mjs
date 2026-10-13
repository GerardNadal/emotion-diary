import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { withJournalTestAccounts } from "./journal-test-fixtures.mjs";
// Provisioning/cleanup only uses the existing admin fixture. All tested diary
// and reporting requests use publishable-key clients and actual Auth tokens.
try {
  await withJournalTestAccounts(async ([company, manager, owner, other]) => {
    const directory = await owner.client.from("profiles").select("team_id").eq("id", owner.id).single();
    assert.ifError(directory.error);
    const team = directory.data.team_id;
    const madrid = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit" }).formatToParts(new Date());
    const d = new Date(Date.UTC(Number(madrid.find((p) => p.type === "year").value), Number(madrid.find((p) => p.type === "month").value) - 2, 1));
    const args = { p_team_id: team, p_period: d.toISOString().slice(0, 10), p_grain: "month" };
    const denied = await owner.client.rpc("collective_statistics", args);
    assert.equal(denied.error?.code, "42501");
    for (const account of [company, manager]) {
      const result = await account.client.rpc("collective_statistics", args);
      assert.ifError(result.error);
      assert.deepEqual(result.data.current, { status: "insufficient_data" });
      assert.ok(!JSON.stringify(result.data).includes(owner.id));
      assert.ok((await account.client.schema("reporting").from("month_releases").select("*")).error);
      assert.ok((await account.client.schema("journal_private").from("entries").select("*")).error);
      assert.ok((await account.client.rpc("collective_statistics", { ...args, user_id: owner.id })).error);
      assert.equal((await account.client.rpc("collective_statistics", { ...args, p_grain: "day" })).error?.code, "22023");
    }
    const unauthorized = await manager.client.rpc("collective_statistics", { ...args, p_team_id: randomUUID() });
    assert.equal(unauthorized.error?.code, "42501");
    assert.equal((await manager.client.rpc("collective_statistics", { ...args, p_team_id: null })).error?.code, "42501");
    const all = await company.client.rpc("collective_statistics", { ...args, p_team_id: null });
    assert.ifError(all.error);
    assert.equal(all.data.coverage, "publishable_teams");
    const id = randomUUID();
    const saved = await owner.client.rpc("journal_save", { p_id: id, p_create: true, p_entry: { mood: "good", emotion: "joy", intensity: 3, occurred_at: `${args.p_period}T12:00:00Z`, reflection: "PRIVATE QA" } });
    assert.ifError(saved.error);
    for (const account of [company, manager, other]) {
      const entry = await account.client.rpc("journal_get", { p_id: id });
      assert.ifError(entry.error); assert.equal(entry.data, null);
      const own = randomUUID();
      assert.ifError((await account.client.rpc("journal_save", { p_id: own, p_create: true, p_entry: { mood: "neutral", emotion: "calm", intensity: 1, occurred_at: `${args.p_period}T12:00:00Z` } })).error);
      assert.ifError((await account.client.rpc("journal_delete", { p_ids: [own] })).error);
    }
    assert.ifError((await owner.client.rpc("journal_delete", { p_ids: [id] })).error);
    // Existing JWT must lose access immediately after an authorized deactivation.
    assert.ifError((await company.client.rpc("save_profile", { p_id: manager.id, p_full_name: "Prueba del diario", p_role: "team_admin", p_team_id: null, p_active: false })).error);
    assert.equal((await manager.client.rpc("collective_statistics", args)).error?.code, "42501");
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    assert.ok((await anon.rpc("collective_statistics", args)).error);
    console.log("PASS: real Auth/PostgREST reporting, role/team restrictions, private diary isolation, strict parameters, inaccessible private schemas, deactivation with an existing JWT and cleanup.");
  });
} catch (error) { console.error(error.message); process.exitCode = 1; }
