import assert from "node:assert/strict";
import { test } from "node:test";
import { loginSchema, passwordSchema } from "../src/modules/auth/validation";
import { profileSchema } from "../src/modules/administration/validation";
test("credentials normalize email without modifying the password", () => {
  assert.deepEqual(loginSchema.parse({ email: "  Person@Example.test ", password: "  pass  " }), { email: "person@example.test", password: "  pass  " });
});
test("password reset enforces length and confirmation", () => {
  assert.equal(passwordSchema.safeParse({ password: "short", confirmation: "short" }).success, false);
  assert.equal(passwordSchema.safeParse({ password: "long-enough-password", confirmation: "different" }).success, false);
  assert.equal(passwordSchema.safeParse({ password: "long-enough-password", confirmation: "long-enough-password" }).success, true);
});
test("employee forms require one team and reject admin membership", () => {
  const input = { id: "", email: "demo@example.test", full_name: "Demo User", role: "employee", active: "true", team_id: "" };
  assert.equal(profileSchema.safeParse(input).success, false);
  const team = "00000000-0000-4000-8000-000000000001";
  assert.equal(profileSchema.safeParse({ ...input, team_id: team }).success, true);
  assert.equal(profileSchema.safeParse({ ...input, role: "company_admin", team_id: team }).success, false);
  assert.equal(profileSchema.safeParse({ ...input, role: "company_admin" }).success, true);
});
