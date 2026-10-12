import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./schema";
import { publicSupabaseEnv } from "./env";

// Only Auth provisioning. Directory reads and mutations ALWAYS use the actor's
// SSR client, so this privileged client cannot bypass directory authorization.
export function createAuthAdminClient() {
  const { url } = publicSupabaseEnv();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Configura SUPABASE_SECRET_KEY en el servidor para dar de alta usuarios.");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
