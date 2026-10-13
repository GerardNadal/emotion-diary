import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedPeriods, collectiveData, collectiveTrend, collectiveTrendSummary, reportingQuery, type CollectiveData } from "../src/modules/administration/reporting-model";
test("reporting permits closed Madrid months and calendar quarters only", () => {
  const periods = allowedPeriods(new Date("2026-10-13T12:00:00Z"));
  assert.equal(periods[0].period,"2026-09-01");
  assert.equal(periods.find((p) => p.grain === "quarter")?.period,"2026-07-01");
  assert.ok(periods.every((p) => p.period < "2026-10-01"));
  assert.equal(allowedPeriods(new Date("2026-09-30T22:30:00Z"))[0].period,"2026-09-01");
  assert.equal(reportingQuery.safeParse({team:null,period:"2026-09-01",grain:"month",user_id:"forged"}).success,false);
  assert.equal(reportingQuery.safeParse({team:null,period:"2026-09-31",grain:"month"}).success,false);
});
test("suppressed aggregate contract cannot carry hidden numbers or private records", () => {
  assert.equal(collectiveData.safeParse({status:"insufficient_data",participants:2}).success,false);
  assert.equal(collectiveData.safeParse({status:"insufficient_data",entries:[]}).success,false);
  assert.match(collectiveTrend({status:"insufficient_data"},{status:"insufficient_data"}),/dos períodos publicables/);
});

test("brief wellbeing trend follows the full report threshold and respects withheld data", () => {
  const withheld: CollectiveData = { status: "insufficient_data" };
  const published = (percent: number): Extract<CollectiveData, { status: "published" }> => ({
    status: "published",
    dimensions: {
      mood: { status: "published", values: [{ value: "good", percent }] },
      emotion: withheld, intensity: withheld, factor: withheld, reason: withheld,
    },
    participation: withheld,
  });
  assert.equal(collectiveTrendSummary(withheld, published(50)), "Sin comparación");
  assert.equal(collectiveTrendSummary(published(50), withheld), "Sin comparación");
  const withheldMood = published(50);
  withheldMood.dimensions.mood = withheld;
  assert.equal(collectiveTrendSummary(withheldMood, published(50)), "Sin comparación");
  assert.equal(collectiveTrendSummary(published(60), published(50)), "Se mantiene");
  assert.equal(collectiveTrendSummary(published(70), published(50)), "Al alza");
  assert.equal(collectiveTrendSummary(published(30), published(50)), "A la baja");
});
