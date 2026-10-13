import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evolutionQuerySchema,
  periodRange,
  descriptiveTrend,
} from "../src/modules/journal/evolution";
import type { Statistics } from "../src/modules/journal/evolution-types";

test("evolution validation rejects ownership, invalid dates, inverted/oversized periods and zones", () => {
  for (const input of [
    { timezone: "UTC", user_id: "other" },
    { timezone: "Not/AZone" },
    { timezone: "UTC", period: "custom" },
    { timezone: "UTC", period: "custom", from: "2026-02-30", to: "2026-03-01" },
    { timezone: "UTC", period: "custom", from: "2026-03-02", to: "2026-03-01" },
    { timezone: "UTC", period: "custom", from: "2026-01-01", to: "2027-01-02" },
  ])
    assert.equal(evolutionQuerySchema.safeParse(input).success, false);
  assert.equal(
    evolutionQuerySchema.safeParse({
      timezone: "UTC",
      period: "custom",
      from: "2024-01-01",
      to: "2024-12-31",
    }).success,
    true,
  );
});
test("rolling periods use local calendar days across years and leap years", () => {
  assert.deepEqual(
    periodRange({ timezone: "UTC", period: "7" }, "2026-01-02"),
    { from: "2025-12-27", to: "2026-01-02" },
  );
  assert.deepEqual(
    periodRange({ timezone: "Europe/Madrid", period: "30" }, "2024-03-01"),
    { from: "2024-02-01", to: "2024-03-01" },
  );
  assert.deepEqual(
    periodRange(
      {
        timezone: "UTC",
        period: "custom",
        from: "2026-01-01",
        to: "2026-02-01",
      },
      "2026-05-01",
    ),
    { from: "2026-01-01", to: "2026-02-01" },
  );
});
test("descriptions do not infer change from sparse or empty periods", () => {
  const stats = {
    current: { entries: 0, recorded_days: 0, mood_average: null },
    previous: { entries: 0, recorded_days: 0, mood_average: null },
  } as Statistics;
  assert.match(descriptiveTrend(stats), /Todavía no/);
  stats.current = {
    entries: 100,
    recorded_days: 1,
    mood_average: 5,
    intensity_average: 4,
  };
  assert.match(descriptiveTrend(stats), /pocos días/);
  stats.current.recorded_days = 3;
  assert.match(descriptiveTrend(stats), /pocos días/);
  stats.previous = {
    entries: 3,
    recorded_days: 3,
    mood_average: 2,
    intensity_average: 1,
  };
  assert.match(descriptiveTrend(stats), /más alto/);
  stats.current.mood_average = 2.1;
  assert.match(descriptiveTrend(stats), /parecido/);
});
