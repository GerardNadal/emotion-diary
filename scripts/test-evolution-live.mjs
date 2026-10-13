import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { withJournalTestAccounts } from "./journal-test-fixtures.mjs";
const base = {
  mood: "good",
  emotion: "calm",
  intensity: 2,
  reflection: "",
  occurred_at: "2026-03-28T23:30:00Z",
};
async function rpc(client, name, args) {
  const result = await client.rpc(name, args);
  if (result.error)
    throw new Error(`${name}: ${result.error.code} ${result.error.message}`);
  return result.data;
}
try {
  await withJournalTestAccounts(async ([company, manager, owner, other]) => {
    await rpc(owner.client, "journal_preferences", {
      p_timezone: "Europe/Madrid",
    });
    const range = { p_from: "2026-03-29", p_to: "2026-03-31" };
    const empty = await rpc(owner.client, "journal_statistics", range);
    assert.equal(empty.current.entries, 0);
    assert.equal(empty.current.mood_average, null);
    assert.equal((await rpc(owner.client, "journal_progress")).current, 0);
    const first = randomUUID();
    const second = randomUUID();
    await rpc(owner.client, "journal_save", {
      p_id: first,
      p_entry: base,
      p_create: true,
    });
    await rpc(owner.client, "journal_save", {
      p_id: second,
      p_entry: {
        ...base,
        mood: "very-low",
        emotion: "anxiety",
        intensity: 5,
        occurred_at: "2026-03-29T21:30:00Z",
      },
      p_create: true,
    });
    const stats = await rpc(owner.client, "journal_statistics", range);
    assert.equal(stats.current.entries, 2);
    assert.equal(stats.current.recorded_days, 1);
    assert.equal(stats.current.mood_average, 2.5);
    assert.equal(stats.current.intensity_average, 3.5);
    assert.equal(stats.days[1].mood_average, null);
    const progress = await rpc(owner.client, "journal_progress");
    assert.equal(progress.current, 1);
    assert.equal(progress.active_days, 1);
    assert.equal(progress.rewards.length, 1);
    assert.deepEqual(progress.days, [progress.today]);
    await Promise.all(
      Array.from({ length: 4 }, () =>
        rpc(owner.client, "journal_save", {
          p_id: first,
          p_entry: base,
          p_create: true,
        }),
      ),
    );
    assert.equal((await rpc(owner.client, "journal_progress")).active_days, 1);
    assert.equal(
      (await rpc(owner.client, "journal_progress")).rewards.length,
      1,
    );
    for (const account of [company, manager, other]) {
      assert.equal(
        (await rpc(account.client, "journal_statistics", range)).current
          .entries,
        0,
      );
      const p = await rpc(account.client, "journal_progress");
      assert.equal(p.active_days, 0);
      assert.deepEqual(p.rewards, []);
      const forged = await account.client.rpc("journal_statistics", {
        ...range,
        user_id: owner.id,
      });
      assert.ok(forged.error);
      assert.ok(
        (
          await account.client
            .schema("journal_private")
            .from("activity_days")
            .select("*")
        ).error,
      );
      const own = randomUUID();
      await rpc(account.client, "journal_save", {
        p_id: own,
        p_entry: base,
        p_create: true,
      });
      assert.equal(
        (
          await rpc(account.client, "journal_statistics", {
            p_from: "2026-03-28",
            p_to: "2026-03-31",
          })
        ).current.entries,
        1,
      );
      await rpc(account.client, "journal_delete", { p_ids: [own] });
      assert.equal(
        (await rpc(account.client, "journal_progress")).active_days,
        1,
      );
    }
    const device = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const login = await device.auth.signInWithPassword({
      email: owner.email,
      password: owner.password,
    });
    assert.ifError(login.error);
    assert.equal(
      await rpc(device, "journal_preferences", { p_timezone: "Asia/Tokyo" }),
      "Europe/Madrid",
    );
    assert.deepEqual(await rpc(device, "journal_progress"), progress);
    await device.auth.signOut({ scope: "local" });
    await rpc(owner.client, "journal_save", {
      p_id: first,
      p_entry: { ...base, reflection: "Completed reflection" },
      p_create: false,
    });
    assert.equal((await rpc(owner.client, "journal_progress")).active_days, 1);
    const calendar = await rpc(owner.client, "journal_days", {
      p_query: {
        timezone: "Europe/Madrid",
        from: "2026-03-29",
        to: "2026-03-29",
      },
    });
    assert.deepEqual(calendar[0].moods, ["good", "very-low"]);
    assert.deepEqual(calendar[0].emotions, ["anxiety", "calm"]);
    await rpc(owner.client, "journal_delete", { p_ids: [first, second] });
    assert.equal(
      (await rpc(owner.client, "journal_statistics", range)).current.entries,
      0,
    );
    assert.equal((await rpc(owner.client, "journal_progress")).active_days, 1);
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } },
    );
    assert.ok((await anon.rpc("journal_statistics", range)).error);
    assert.ok((await anon.rpc("journal_progress")).error);
    console.log(
      "PASS: real Auth/PostgREST aggregates, DST, all-role isolation, concurrent idempotency, persistent timezone across devices, activity, rewards and cleanup.",
    );
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
