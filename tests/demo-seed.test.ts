import assert from "node:assert/strict";
import { test } from "node:test";
import { demoTeams, demoManagers, demoProfiles, demoEntries, demoEndDate } from "../scripts/demo-data.mjs";
import { journalInputSchema, entryIdSchema } from "../src/modules/journal/validation";
import { moods, emotions, reasonGroups } from "../src/modules/journal/emotions";

type DemoProfile = { email: string; full_name: string; role: string; team: string | null; active: boolean };
type DemoEntry = ReturnType<typeof demoEntries>[number];
const profiles: DemoProfile[] = demoProfiles();

test("expanded demo has paginated directories, inactive employees and distinct manager scopes", () => {
  assert.equal(profiles.length, 65);
  assert.equal(new Set(profiles.map((profile) => profile.email)).size, 65);
  for (const team of demoTeams) {
    const employees = profiles.filter((profile) => profile.team === team.key);
    assert.equal(employees.length, 10);
    assert.equal(employees.filter((profile) => profile.active).length, 9);
  }
  assert.equal(profiles.filter((profile) => profile.role === "team_admin").length, 4);
  assert.deepEqual(demoManagers[0].teams, ["desarrollo", "producto"]);
  assert.equal(demoManagers[0].teams.includes("operaciones"), false);
  assert.deepEqual(new Set(demoManagers.flatMap((manager: { teams: string[] }) => manager.teams)), new Set(demoTeams.map((team: { key: string }) => team.key)));
  assert.equal(profiles.find((profile) => profile.email === "desarrollo@example.test")?.full_name, "Lucía Demo");
  assert.equal(profiles.find((profile) => profile.email === "operaciones@example.test")?.full_name, "David Demo");
});

test("180-day demo entries satisfy the actual journal contract and cover useful analysis cases", () => {
  const all: DemoEntry[] = profiles.flatMap((profile) => demoEntries(profile, { days: 180, endDate: "2026-10-12" }));
  assert.ok(all.length > 7500 && all.length < 10000);
  assert.equal(new Set(all.map((item) => item.id)).size, all.length);
  for (const { id, entry } of all) {
    entryIdSchema.parse(id);
    journalInputSchema.parse(entry);
    assert.ok(entry.occurred_at >= "2026-04-16" && entry.occurred_at < "2026-10-13");
  }
  assert.deepEqual(new Set(all.map(({ entry }) => entry.mood)), new Set(moods.map((mood) => mood.value)));
  assert.deepEqual(new Set(all.map(({ entry }) => entry.emotion)), new Set(emotions.map((emotion) => emotion.value)));
  assert.deepEqual(new Set(all.map(({ entry }) => entry.intensity)), new Set([1, 2, 3, 4, 5]));
  assert.deepEqual(new Set(all.filter(({ entry }) => entry.reason).map(({ entry }) => `${entry.category}:${entry.reason}`)), new Set(reasonGroups.flatMap((group) => group.reasons.map((reason) => `${group.value}:${reason.value}`))));
  for (const predicate of [
    (entry: DemoEntry["entry"]) => !entry.category,
    (entry: DemoEntry["entry"]) => !!entry.custom_reason,
    (entry: DemoEntry["entry"]) => !entry.reflection,
    (entry: DemoEntry["entry"]) => !!entry.reflection && !!entry.reaction && !!entry.support,
  ]) assert.ok(all.some(({ entry }) => predicate(entry)));
  assert.equal(demoEntries(profiles.find((profile) => !profile.active)).length, 0);
});

test("fixture IDs and content remain stable when re-running, extending or rolling the window", () => {
  const profile = profiles[0];
  const short: DemoEntry[] = demoEntries(profile, { days: 30, endDate: "2026-10-12" });
  assert.deepEqual(short, demoEntries(profile, { days: 30, endDate: "2026-10-12" }));
  for (const endDate of ["2026-10-12", "2026-10-13"]) {
    const extended = new Map<string, DemoEntry>(demoEntries(profile, { days: 180, endDate }).map((entry: DemoEntry) => [entry.id, entry]));
    for (const entry of short) assert.deepEqual(extended.get(entry.id), entry);
  }
  assert.throws(() => demoEntries(profile, { days: 366 }));
  assert.throws(() => demoEntries(profile, { days: 0 }));
  assert.throws(() => demoEntries(profile, { endDate: "2026-02-30" }));
});

test("demo uses completed Madrid days across UTC midnight and daylight-saving changes", () => {
  assert.equal(demoEndDate(new Date("2026-10-12T22:30:00Z")), "2026-10-12");
  assert.equal(demoEndDate(new Date("2026-10-12T20:30:00Z")), "2026-10-11");
  assert.equal(demoEndDate(new Date("2026-10-25T23:30:00Z")), "2026-10-25");
});
