"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ActionState } from "@/modules/shared/action-state";
import { emailSchema, loginSchema, passwordSchema } from "./validation";
import { homeForRole } from "./roles";
import { requireProfile } from "./session";

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { message: "La conexión con Supabase todavía no está configurada." };
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "Introduce un correo válido y tu contraseña." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { message: "No se ha podido iniciar sesión. Comprueba tus credenciales." };
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("*").eq("id", data.user.id).eq("active", true).maybeSingle();
  if (profileError || !profile) {
    await supabase.auth.signOut({ scope: "local" });
    return { message: "Tu cuenta no tiene acceso. Contacta con la administración." };
  }
  redirect(homeForRole(profile.role));
}

export async function recoverAction(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { message: "La conexión con Supabase todavía no está configurada." };
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { message: "Introduce un correo válido." };
  const origin = process.env.APP_URL;
  if (!origin) return { message: "La recuperación de acceso todavía no está configurada." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: new URL("/auth/callback", origin).toString(),
  });
  if (error) return { message: "No se ha podido solicitar el correo. Inténtalo más tarde." };
  return { ok: true, message: "Si la cuenta existe, recibirás un correo para establecer tu contraseña." };
}

export async function updatePasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  const supabase = await createClient();
  // Check with Auth too, as this is a sensitive operation.
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) return { message: "El enlace ha caducado. Solicita otro correo de recuperación." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { message: "No se ha podido cambiar la contraseña. Solicita un nuevo enlace e inténtalo otra vez." };
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?password=updated");
}

export async function logoutAction() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("No se ha podido cerrar la sesión. Inténtalo de nuevo.");
  redirect("/login");
}
