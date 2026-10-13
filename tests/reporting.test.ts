import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedPeriods, collectiveData, collectiveTrend, reportingQuery } from "../src/modules/administration/reporting-model";
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
