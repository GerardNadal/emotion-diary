import { z } from "zod";
import { adminClient, requireResult, strongPassword, createAccount, compensateAccount } from "./admin-env.mjs";

try {
  const password = strongPassword.parse(process.env.DEMO_PASSWORD);
  const client = adminClient();
  const admins = requireResult(await client.from("profiles").select("id").eq("role", "company_admin").eq("active", true).limit(1), "Comprobar administrador");
  if (!admins.length) throw new Error("Ejecuta primero auth:bootstrap.");
  const teams = [];
  for (const name of ["Demo · Desarrollo", "Demo · Operaciones"]) {
    const existing = requireResult(await client.from("teams").select("id").eq("name", name).maybeSingle(), "Consultar equipo demo");
    const team = existing ?? requireResult(await client.from("teams").insert({ name }).select("id").single(), "Crear equipo demo");
    teams.push(team.id);
  }
  const users = [
    { email: "empresa@example.test", full_name: "Elena Demo", role: "company_admin", team_id: null },
    { email: "responsable@example.test", full_name: "Mario Demo", role: "team_admin", team_id: null },
    { email: "desarrollo@example.test", full_name: "Lucía Demo", role: "employee", team_id: teams[0] },
    { email: "operaciones@example.test", full_name: "David Demo", role: "employee", team_id: teams[1] },
  ];
  let managerId;
  for (const profile of users) {
    const existing = requireResult(await client.from("profiles").select("id, role, team_id, full_name, active").eq("email", profile.email).maybeSingle(), "Consultar usuario demo");
    if (existing) {
      if (existing.role !== profile.role || existing.team_id !== profile.team_id || existing.full_name !== profile.full_name || !existing.active) {
        throw new Error(`La cuenta ${profile.email} ya existe y no coincide con la demo. No se sobrescribirá.`);
      }
      if (profile.role === "team_admin") managerId = existing.id;
      continue;
    }
    const user = await createAccount(client, { email: profile.email, password, email_confirm: true });
    try { requireResult(await client.from("profiles").insert({ id: user.id, ...profile }), "Crear perfil demo"); }
    catch (error) { await compensateAccount(client, user.id); throw error; }
    if (profile.role === "team_admin") managerId = user.id;
  }
  // The manager only owns Desarrollo: Operaciones exercises cross-team denial.
  requireResult(await client.from("team_managers").upsert({ team_id: teams[0], profile_id: managerId }, { onConflict: "team_id,profile_id" }), "Asignar responsable demo");
  console.log("Demo preparada. Cuentas: empresa@example.test, responsable@example.test, desarrollo@example.test, operaciones@example.test. Usa DEMO_PASSWORD. Las cuentas existentes conservan su contraseña.");
} catch (error) {
  console.error(error instanceof z.ZodError ? "Configura DEMO_PASSWORD con al menos 12 caracteres." : error.message);
  process.exitCode = 1;
}
