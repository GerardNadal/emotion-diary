import { createClient } from "@supabase/supabase-js";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { adminClient, requireResult, strongPassword, createAccount, compensateAccount } from "./admin-env.mjs";
import { demoTeams, demoManagers, demoProfiles, demoEntries, demoEndDate } from "./demo-data.mjs";
import { attestDemoReporting } from "./demo-reporting.mjs";

async function authWithRetry(operation) {
  let result = await operation();
  if (result.error?.status === 429 || result.error?.code === "over_request_rate_limit") {
    console.log("Límite temporal de Auth; reintentando la sesión en 15 segundos…");
    await delay(15_000);
    result = await operation();
  }
  return result;
}

async function seedJournal(admin, profile, entries, password) {
  if (!entries.length) return 0;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Prefer password sessions to avoid consuming the smaller OTP verification quota.
  // Existing demo passwords may differ: fall back without changing them or emailing.
  let login = await authWithRetry(() => client.auth.signInWithPassword({ email: profile.email, password }));
  if (login.error?.code === "invalid_credentials") {
    const link = requireResult(await admin.auth.admin.generateLink({ type: "magiclink", email: profile.email }), "Preparar sesión demo");
    if (link.user.id !== profile.id) throw new Error("La identidad Auth no coincide con el perfil demo.");
    login = await authWithRetry(() => client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token }));
  }
  const session = requireResult(login, "Abrir sesión demo");
  try {
    if (session.user?.id !== profile.id) throw new Error("Sesión demo incorrecta.");
    requireResult(await client.rpc("journal_preferences", { p_timezone: "Europe/Madrid", p_replace: false }), "Preparar zona horaria demo");
    const query = { timezone: "UTC", from: entries[0].entry.occurred_at.slice(0, 10), to: entries.at(-1).entry.occurred_at.slice(0, 10) };
    const existing = new Set();
    for (let page = 1; ; page++) {
      const result = requireResult(await client.rpc("journal_list", { p_query: { ...query, page } }), "Consultar diario demo");
      for (const entry of result.entries) existing.add(entry.id);
      if (page * result.page_size >= result.total) break;
    }
    const pending = entries.filter(({ id }) => !existing.has(id));
    // Bounded concurrency through each owner's existing RLS-protected RPC.
    // Settle every batch before surfacing an error so retries resume safely.
    for (let offset = 0; offset < pending.length; offset += 4) {
      const results = await Promise.allSettled(pending.slice(offset, offset + 4).map(async ({ id, entry }) => {
        requireResult(await client.rpc("journal_save", { p_id: id, p_entry: entry, p_create: true }), "Guardar entrada demo");
      }));
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
    }
    const result = requireResult(await client.rpc("journal_list", { p_query: { ...query, page: 1 } }), "Verificar diario demo");
    if (result.total !== existing.size + pending.length) throw new Error(`Revisa el diario demo de ${profile.email}: el total no coincide.`);
    return pending.length;
  } finally {
    requireResult(await client.auth.signOut({ scope: "local" }), "Cerrar sesión de seed");
  }
}

try {
  const days = z.coerce.number().int().min(7).max(365).parse(process.env.DEMO_DAYS ?? 180);
  const endDate = demoEndDate();
  const profiles = demoProfiles();
  const journals = new Map(profiles.filter((profile) => profile.active).map((profile) => [profile.email, demoEntries(profile, { days, endDate })]));
  const totalEntries = [...journals.values()].reduce((total, entries) => total + entries.length, 0);
  console.log(`Demo: ${demoTeams.length} equipos, 60 empleados (54 activos y 6 inactivos), 4 responsables y 1 administrador de empresa.`);
  console.log(`Historial: ${totalEntries} entradas ficticias durante ${days} días, hasta ${endDate}.`);
  if (process.argv.includes("--dry-run")) {
    console.log("Previsualización completada. No se han consultado ni modificado cuentas o datos.");
  } else {
    const password = strongPassword.parse(process.env.DEMO_PASSWORD);
    z.string().min(1).parse(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const client = adminClient();
    const admins = requireResult(await client.from("profiles").select("id").eq("role", "company_admin").eq("active", true).limit(1), "Comprobar administrador");
    if (!admins.length) throw new Error("Ejecuta primero auth:bootstrap.");
    const teamIds = new Map();
    for (const { key, name } of demoTeams) {
      const existing = requireResult(await client.from("teams").select("id").eq("name", name).maybeSingle(), "Consultar equipo demo");
      const team = existing ?? requireResult(await client.from("teams").insert({ name }).select("id").single(), "Crear equipo demo");
      teamIds.set(key, team.id);
    }
    const accounts = new Map();
    for (const { team, ...profile } of profiles) {
      const expected = { ...profile, team_id: team ? teamIds.get(team) : null };
      const existing = requireResult(await client.from("profiles").select("id, role, team_id, full_name, active").eq("email", profile.email).maybeSingle(), "Consultar usuario demo");
      if (existing) {
        if (["role", "team_id", "full_name", "active"].some((field) => existing[field] !== expected[field])) {
          throw new Error(`La cuenta ${profile.email} ya existe y no coincide con la demo. No se sobrescribirá.`);
        }
        accounts.set(profile.email, { ...expected, id: existing.id });
        continue;
      }
      const user = await createAccount(client, { email: profile.email, password, email_confirm: true });
      try { requireResult(await client.from("profiles").insert({ id: user.id, ...expected }), "Crear perfil demo"); }
      catch (error) { await compensateAccount(client, user.id); throw error; }
      accounts.set(profile.email, { ...expected, id: user.id });
    }
    const assignments = demoManagers.flatMap((manager) => manager.teams.map((team) => ({ team_id: teamIds.get(team), profile_id: accounts.get(manager.email).id })));
    requireResult(await client.from("team_managers").upsert(assignments, { onConflict: "team_id,profile_id", ignoreDuplicates: true }), "Asignar responsables demo");
    console.log("Directorio preparado. Cargando diarios privados de las cuentas demo…");
    let added = 0;
    const active = [...accounts.values()].filter((account) => account.active);
    for (let offset = 0; offset < active.length; offset += 3) {
      const batchStarted = Date.now();
      const results = await Promise.allSettled(active.slice(offset, offset + 3).map(async (profile) => {
        const count = await seedJournal(client, profile, journals.get(profile.email), password);
        console.log(`${profile.email}: ${count} entradas nuevas; diario verificado.`);
        return count;
      }));
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
      added += results.reduce((total, result) => total + result.value, 0);
      // Fast re-runs otherwise consume the password endpoint's burst allowance.
      if (offset + 3 < active.length) await delay(Math.max(0, 6000 - (Date.now() - batchStarted)));
    }
    console.log(`Demo preparada y verificada: ${added} entradas nuevas. Las cuentas y entradas existentes conservan sus contraseñas y contenido.`);
    console.log("Acceso: empresa@example.test, responsable@example.test, responsable.operaciones@example.test, responsable.marketing@example.test y responsable.personas@example.test. Nuevas cuentas: DEMO_PASSWORD.");
    await attestDemoReporting({ days, endDate });
  }
} catch (error) {
  console.error(error instanceof z.ZodError ? "Revisa DEMO_PASSWORD (12–128 caracteres), DEMO_DAYS (7–365) y la clave pública de Supabase." : error.message);
  process.exitCode = 1;
}
