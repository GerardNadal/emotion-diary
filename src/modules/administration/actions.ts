"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAuthAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/modules/auth/session";
import type { ActionState } from "@/modules/shared/action-state";
import { profileSchema, teamSchema, managerSchema } from "./validation";

function databaseMessage(code?: string) {
  if (code === "42501") return "No tienes permiso para realizar este cambio.";
  if (code === "23505") return "Ya existe un usuario o equipo con esos datos.";
  if (code === "23503" || code === "23514" || code === "22023") return "Revisa el equipo, el rol y los datos introducidos.";
  return "No se ha podido guardar el cambio. Inténtalo de nuevo.";
}
function refreshDirectory() {
  revalidatePath("/admin", "layout");
  revalidatePath("/company");
  revalidatePath("/team");
}

export async function saveProfileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireProfile(["company_admin", "team_admin"]);
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  const input = parsed.data;
  const supabase = await createClient();
  // Preflight before privileged Auth provisioning; PostgreSQL repeats the checks
  // transactionally with the caller's session when creating the directory row.
  if (input.team_id) {
    const { data, error } = await supabase.from("teams").select("id").eq("id", input.team_id).maybeSingle();
    if (error || !data) return { message: "El equipo no existe o no está autorizado." };
  }
  if (actor.role === "team_admin" && (input.role !== "employee" || !input.team_id)) {
    return { message: "Solo puedes administrar empleados de tus equipos." };
  }
  if (input.id) {
    const { data, error } = await supabase.from("profiles").select("id, role, email").eq("id", input.id).maybeSingle();
    if (error || !data || (actor.role === "team_admin" && data.role !== "employee")) {
      return { message: "No tienes permiso para modificar ese usuario." };
    }
    if (input.email !== data.email) return { message: "El correo de acceso no se modifica desde el directorio." };
  }
  let id = input.id;
  let authAdmin: ReturnType<typeof createAuthAdminClient> | undefined;
  if (!id) {
    if (!input.active) return { message: "Crea primero la cuenta activa; podrás desactivarla después." };
    try { authAdmin = createAuthAdminClient(); }
    catch { return { message: "Las altas requieren configurar la clave privada de Supabase en el servidor." }; }
    const { data, error } = await authAdmin.auth.admin.createUser({
      email: input.email, password: randomBytes(32).toString("base64url"), email_confirm: true,
    });
    if (error || !data.user) return { message: "No se ha podido dar de alta la cuenta. Comprueba si el correo ya existe." };
    id = data.user.id;
  }
  const { error } = await supabase.rpc("save_profile", {
    p_id: id, p_full_name: input.full_name, p_role: input.role,
    p_team_id: input.team_id, p_active: input.active,
  });
  if (error) {
    if (authAdmin) {
      // Compensate Auth creation if the DB rejected it. FK RESTRICT protects a
      // committed profile if a transport failure hid a successful DB response.
      const { error: cleanupError } = await authAdmin.auth.admin.deleteUser(id);
      if (cleanupError) console.error("Auth provisioning reconciliation required", { userId: id, code: cleanupError.code });
    }
    return { message: databaseMessage(error.code) };
  }
  refreshDirectory();
  return { ok: true, message: input.id ? "Usuario actualizado." : "Usuario creado. Debe usar «Recuperar acceso» para establecer su contraseña." };
}

export async function saveTeamAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["company_admin"]);
  const parsed = teamSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "Introduce un nombre de equipo de 2 a 100 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_team", { p_id: parsed.data.id, p_name: parsed.data.name });
  if (error) return { message: databaseMessage(error.code) };
  refreshDirectory();
  return { ok: true, message: "Equipo guardado." };
}

export async function setManagerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["company_admin"]);
  const parsed = managerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "Selecciona un equipo y un responsable válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_team_manager", {
    p_team_id: parsed.data.team_id, p_profile_id: parsed.data.profile_id, p_assigned: parsed.data.assigned,
  });
  if (error) return { message: databaseMessage(error.code) };
  refreshDirectory();
  return { ok: true, message: parsed.data.assigned ? "Responsable asignado." : "Asignación retirada." };
}
