import test from "node:test";
import assert from "node:assert/strict";
import {
  journalInputSchema,
  journalQuerySchema,
  deleteIdsSchema,
} from "../src/modules/journal/validation";
import { monthRange, weekRange, localDay } from "../src/modules/journal/dates";
const valid = {
  mood: "good",
  emotion: "joy",
  intensity: 3,
  category: null,
  reason: null,
  custom_reason: "",
  reflection: "",
  activity: "",
  reaction: "",
  support: "",
  occurred_at: "2026-10-13T08:00:00Z",
};
test("journal rejects forged ownership, invalid category/reason and oversized text", () => {
  assert.ok(journalInputSchema.safeParse(valid).success);
  for (const bad of [
    { user_id: "other" },
    { category: "work", reason: "sleep" },
    { custom_reason: "Other" },
    { reflection: "x".repeat(2001) },
    { intensity: 6 },
    { emotion: "translated" },
    { occurred_at: "bad" },
  ])
    assert.equal(
      journalInputSchema.safeParse({ ...valid, ...bad }).success,
      false,
    );
  assert.ok(
    journalInputSchema.safeParse({
      ...valid,
      category: "work",
      custom_reason: "Something else",
    }).success,
  );
});
test("query dates, timezone and bulk identifiers are validated", () => {
  assert.ok(
    journalQuerySchema.safeParse({ timezone: "Europe/Madrid" }).success,
  );
  for (const bad of [
    { timezone: "unknown" },
    { page: 0 },
    { from: "2026-02-30" },
    { from: "2026-02-03", to: "2026-02-01" },
  ])
    assert.equal(
      journalQuerySchema.safeParse({ timezone: "UTC", ...bad }).success,
      false,
    );
  assert.equal(deleteIdsSchema.safeParse([]).success, false);
  assert.equal(
    deleteIdsSchema.safeParse([
      "f3100000-0000-4000-8000-000000000001",
      "f3100000-0000-4000-8000-000000000001",
    ]).success,
    false,
  );
});
test("calendar helpers preserve local dates, weeks across years and leap months", () => {
  assert.deepEqual(monthRange("2024-02"), {
    from: "2024-02-01",
    to: "2024-02-29",
  });
  assert.deepEqual(weekRange("2026-01-01"), {
    from: "2025-12-29",
    to: "2026-01-04",
  });
  assert.equal(
    localDay(new Date("2026-03-28T23:30:00Z"), "Europe/Madrid"),
    "2026-03-29",
  );
});
