import test from "node:test";
import assert from "node:assert/strict";
import {
  navigationForRole,
  isNavigationActive,
} from "../src/modules/shared/navigation";

test("employees have only personal navigation", () => {
  const { personal, administration } = navigationForRole("employee");
  assert.equal(administration.length, 0);
  assert.equal(personal[0].href, "/employee");
  assert.ok(personal.every((entry) => !entry.href.startsWith("/admin")));
});

test("both administrator roles retain access to their own diary", () => {
  for (const role of ["company_admin", "team_admin"] as const) {
    const { personal, administration } = navigationForRole(role);
    assert.equal(personal[0].href, "/journal");
    assert.equal(
      administration[0].href,
      role === "company_admin" ? "/company" : "/team",
    );
    assert.ok(personal.some((entry) => entry.href === "/journal/history"));
    assert.ok(administration.every((entry) => !entry.href.includes("journal")));
  }
});

test("the journal editor activates the diary only, without prefix collisions", () => {
  assert.equal(isNavigationActive("/journal/new", "/journal/history"), true);
  assert.equal(isNavigationActive("/journal/new", "/journal"), false);
  assert.equal(isNavigationActive("/admin/users/new", "/admin/users"), true);
  assert.equal(isNavigationActive("/admin/users-other", "/admin/users"), false);
  assert.equal(isNavigationActive("/journal", "/employee"), true);
});
