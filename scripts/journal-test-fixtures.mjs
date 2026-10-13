import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { adminClient, requireResult } from "./admin-env.mjs";

// Privileged client is used only to provision/remove isolated test identities.
// Every journal operation uses the authenticated user's publishable-key client.
export async function withJournalTestAccounts(run) {
  const admin = adminClient();
  const password = randomBytes(24).toString("base64url");
  const tag = randomUUID();
  const accounts = [];
  let team;
  try {
    team = requireResult(
      await admin
        .from("teams")
        .insert({ name: `Journal QA ${tag}` })
        .select("id")
        .single(),
      "Create isolated test team",
    );
    for (const [index, role] of [
      "company_admin",
      "team_admin",
      "employee",
      "employee",
    ].entries()) {
      const email = `journal-qa-${tag}-${index}@example.test`;
      const created = requireResult(
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        }),
        "Create isolated test Auth user",
      );
      const account = { id: created.user.id, email, password, role };
      accounts.push(account);
      requireResult(
        await admin
          .from("profiles")
          .insert({
            id: account.id,
            email,
            full_name: "Prueba del diario",
            role,
            team_id: role === "employee" ? team.id : null,
          }),
        "Create isolated profile",
      );
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      requireResult(
        await client.auth.signInWithPassword({ email, password }),
        "Sign in real Auth user",
      );
      account.client = client;
    }
    requireResult(
      await admin
        .from("team_managers")
        .insert({ profile_id: accounts[1].id, team_id: team.id }),
      "Assign isolated manager",
    );
    await run(accounts);
  } finally {
    const failures = [];
    for (const account of accounts.reverse()) {
      if (account.client) await account.client.auth.signOut();
      const profile = await admin
        .from("profiles")
        .delete()
        .eq("id", account.id);
      if (profile.error) failures.push(`profile ${account.id}`);
      else {
        const user = await admin.auth.admin.deleteUser(account.id);
        if (user.error) failures.push(`Auth ${account.id}`);
      }
    }
    if (team) {
      const result = await admin.from("teams").delete().eq("id", team.id);
      if (result.error) failures.push(`team ${team.id}`);
    }
    if (failures.length)
      throw new Error(`Test fixture cleanup required: ${failures.join(", ")}`);
  }
}
