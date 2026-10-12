import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export function adminClient() {
  const config = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(), SUPABASE_SECRET_KEY: z.string().min(1),
  }).parse(process.env);
  const hostname = new URL(config.NEXT_PUBLIC_SUPABASE_URL).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname) && !process.argv.includes("--allow-remote")) {
    throw new Error("Operación remota bloqueada. Revisa el proyecto y usa --allow-remote para un entorno de demostración.");
  }
  return createClient(config.NEXT_PUBLIC_SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function requireResult(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.code ?? "error"}. Revisa las migraciones y la configuración.`);
  return result.data;
}
export const strongPassword = z.string().min(12).max(128);

export async function createAccount(client, input) {
  const data = requireResult(await client.auth.admin.createUser(input), "Crear cuenta Auth");
  if (!data?.user) throw new Error("Auth no devolvió la cuenta creada.");
  return data.user;
}
export async function compensateAccount(client, id) {
  const { error } = await client.auth.admin.deleteUser(id);
  if (error) console.error(`Reconciliación necesaria: cuenta Auth ${id}; código ${error.code ?? "error"}.`);
}
