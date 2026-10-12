import { z } from "zod";
import { adminClient, requireResult, strongPassword, createAccount, compensateAccount } from "./admin-env.mjs";

try {
  const input = z.object({
    BOOTSTRAP_EMAIL: z.email().max(254), BOOTSTRAP_NAME: z.string().trim().min(2).max(100),
    BOOTSTRAP_PASSWORD: strongPassword,
  }).parse(process.env);
  const client = adminClient();
  const existing = requireResult(await client.from("profiles").select("id").eq("role", "company_admin").limit(1), "Comprobar inicialización");
  if (existing.length) throw new Error("El administrador ya está inicializado. No se modificaron credenciales.");
  const user = await createAccount(client, { email: input.BOOTSTRAP_EMAIL.toLowerCase(), password: input.BOOTSTRAP_PASSWORD, email_confirm: true });
  try {
    requireResult(await client.rpc("bootstrap_admin", { p_id: user.id, p_full_name: input.BOOTSTRAP_NAME }), "Inicializar administrador");
  } catch (error) { await compensateAccount(client, user.id); throw error; }
  console.log("Administrador inicial creado. Inicia sesión con las credenciales que proporcionaste; elimina BOOTSTRAP_PASSWORD del entorno.");
} catch (error) {
  console.error(error instanceof z.ZodError ? "Faltan variables válidas BOOTSTRAP_EMAIL, BOOTSTRAP_NAME o BOOTSTRAP_PASSWORD (mínimo 12 caracteres)." : error.message);
  process.exitCode = 1;
}
