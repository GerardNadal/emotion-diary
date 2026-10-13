import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { withJournalTestAccounts } from "./journal-test-fixtures.mjs";

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.code}`);
  return data;
}
try {
  await withJournalTestAccounts(async ([company, manager, owner, other]) => {
    const id = randomUUID();
    await rpc(owner.client, "journal_preferences", { p_timezone: "Europe/Madrid" });
    await rpc(owner.client, "journal_save", {
      p_id: id, p_create: true,
      p_entry: { mood: "low", emotion: "anxiety", intensity: 3, occurred_at: new Date().toISOString() },
    });
    for (const account of [company, manager, other]) {
      assert.ok((await account.client.rpc("ai_reserve", { p_entry_id: id })).error);
      assert.equal(await rpc(account.client, "journal_get", { p_id: id }), null);
      assert.ok((await account.client.rpc("ai_reserve", { p_entry_id: id, user_id: owner.id })).error);
      assert.ok((await account.client.schema("journal_private").from("ai_usage").select("*")).error);
    }
    const requests = await Promise.all(Array.from({ length: 8 }, () => rpc(owner.client, "ai_reserve", { p_entry_id: id })));
    assert.equal(requests.filter(r => r.allowed).length, 1);
    assert.equal(requests.filter(r => r.reason === "busy").length, 7);
    await rpc(other.client, "ai_release", { p_token: requests.find(r => r.allowed).token });
    assert.equal((await rpc(owner.client, "ai_reserve", { p_entry_id: id })).reason, "busy");
    await rpc(owner.client, "ai_release", { p_token: requests.find(r => r.allowed).token });
    assert.equal((await rpc(owner.client, "ai_reserve", { p_entry_id: id })).reason, "limit");
    const completions = await Promise.all(Array.from({ length: 8 }, () => rpc(other.client, "wellbeing_complete", { p_activity: "pause" })));
    assert.equal(completions.filter(Boolean).length, 1);
    const progress = await rpc(other.client, "journal_progress");
    assert.equal(progress.current, 1); assert.equal(progress.active_days, 1); assert.equal(progress.rewards.length, 1);
    assert.ok((await other.client.rpc("wellbeing_complete", { p_activity: "tampered" })).error);
    assert.equal((await rpc(company.client, "journal_progress")).active_days, 0);
    console.log("PASS: real Auth/PostgREST owner authorization, administrator isolation, manipulated RPCs, concurrent quotas, lease ownership, cooldown, idempotent wellbeing completion, streak/rewards and fixture cleanup.");
  });
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}
