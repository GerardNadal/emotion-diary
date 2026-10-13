import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { withJournalTestAccounts } from "./journal-test-fixtures.mjs";
const input = {
  mood: "good",
  emotion: "joy",
  intensity: 3,
  reflection: "Isolated QA entry",
  category: "work",
  reason: "achievement",
  custom_reason: "",
  activity: "Walk",
  reaction: "Smile",
  support: "",
  occurred_at: "2026-03-28T23:30:00Z",
};
async function rpc(client, name, args) {
  const result = await client.rpc(name, args);
  if (result.error)
    throw new Error(`${name}: ${result.error.code} ${result.error.message}`);
  return result.data;
}
try {
  await withJournalTestAccounts(async ([company, manager, a, b]) => {
    const id = randomUUID();
    const first = await rpc(a.client, "journal_save", {
      p_id: id,
      p_entry: input,
      p_create: true,
    });
    assert.equal(first.activity, "Walk");
    assert.equal(first.user_id, undefined);
    assert.equal((await rpc(a.client, "journal_get", { p_id: id })).id, id);
    await rpc(a.client, "journal_save", {
      p_id: id,
      p_entry: input,
      p_create: true,
    });
    assert.equal(
      (await rpc(a.client, "journal_list", { p_query: { timezone: "UTC" } }))
        .total,
      1,
    );
    for (const account of [company, manager, b]) {
      assert.equal(
        await rpc(account.client, "journal_get", { p_id: id }),
        null,
      );
      assert.equal(
        (
          await rpc(account.client, "journal_list", {
            p_query: { timezone: "UTC" },
          })
        ).total,
        0,
      );
      assert.deepEqual(
        await rpc(account.client, "journal_days", {
          p_query: { timezone: "UTC", from: "2026-03-01", to: "2026-03-31" },
        }),
        [],
      );
      for (const [name, args] of [
        ["journal_save", { p_id: id, p_entry: input, p_create: false }],
        ["journal_delete", { p_ids: [id] }],
      ])
        assert.equal(
          (await account.client.rpc(name, args)).error?.code,
          "42501",
        );
      const own = randomUUID();
      await rpc(account.client, "journal_save", {
        p_id: own,
        p_entry: input,
        p_create: true,
      });
      assert.equal(
        await rpc(account.client, "journal_delete", { p_ids: [own] }),
        1,
      );
      const table = await account.client
        .schema("journal_private")
        .from("entries")
        .select("*");
      assert.ok(table.error);
    }
    assert.equal(
      (
        await a.client.rpc("journal_save", {
          p_id: randomUUID(),
          p_entry: { ...input, user_id: b.id },
          p_create: true,
        })
      ).error?.code,
      "22023",
    );
    const updated = await rpc(a.client, "journal_save", {
      p_id: id,
      p_entry: { ...input, reflection: "Updated QA entry" },
      p_create: false,
    });
    assert.equal(updated.reflection, "Updated QA entry");
    assert.equal(updated.created_at, first.created_at);
    const otherId = randomUUID();
    await rpc(a.client, "journal_save", {
      p_id: otherId,
      p_entry: {
        ...input,
        emotion: "peace",
        occurred_at: "2026-03-29T21:30:00Z",
      },
      p_create: true,
    });
    const range = {
      timezone: "Europe/Madrid",
      from: "2026-03-29",
      to: "2026-03-29",
    };
    assert.equal(
      (await rpc(a.client, "journal_list", { p_query: range })).total,
      2,
    );
    assert.equal(
      (await rpc(a.client, "journal_days", { p_query: range }))[0].count,
      2,
    );
    assert.equal(
      (
        await rpc(a.client, "journal_list", {
          p_query: {
            ...range,
            emotion: "peace",
            category: "work",
            intensity: 3,
          },
        })
      ).total,
      1,
    );
    const ids = [];
    for (let i = 0; i < 25; i++) {
      const next = randomUUID();
      ids.push(next);
      await rpc(a.client, "journal_save", {
        p_id: next,
        p_entry: { ...input, occurred_at: "2026-04-01T12:00:00Z" },
        p_create: true,
      });
    }
    const pages = [];
    for (let page = 1; page <= 3; page++)
      pages.push(
        await rpc(a.client, "journal_list", {
          p_query: {
            timezone: "UTC",
            from: "2026-04-01",
            to: "2026-04-01",
            page,
            order: "asc",
          },
        }),
      );
    assert.deepEqual(
      pages.map((p) => p.entries.length),
      [12, 12, 1],
    );
    assert.equal(
      new Set(pages.flatMap((p) => p.entries.map((e) => e.id))).size,
      25,
    );
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } },
    );
    assert.ok((await anon.rpc("journal_get", { p_id: id })).error);
    for (let i = 0; i < ids.length; i += 12)
      await rpc(a.client, "journal_delete", { p_ids: ids.slice(i, i + 12) });
    assert.equal(
      await rpc(a.client, "journal_delete", { p_ids: [id, otherId] }),
      2,
    );
    assert.equal(await rpc(a.client, "journal_get", { p_id: id }), null);
    console.log(
      "PASS: real Supabase Auth + PostgREST CRUD, idempotency, all-role isolation, filters, pagination, local calendar, anonymous denial and cleanup.",
    );
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
