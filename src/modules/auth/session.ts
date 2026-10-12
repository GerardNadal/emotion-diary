import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AppRole } from "@/lib/supabase/database.types";
import { homeForRole } from "./roles";

export const getCurrentProfile = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getClaims();
  if (error || !auth?.claims.sub) return null;
  const { data, error: profileError } = await supabase.from("profiles")
    .select("*").eq("id", auth.claims.sub).eq("active", true).maybeSingle();
  if (profileError) throw new Error("No se ha podido consultar el perfil. Comprueba las migraciones de Supabase.");
  return data;
});

export async function requireProfile(roles?: AppRole[]) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (roles && !roles.includes(profile.role)) redirect(homeForRole(profile.role));
  return profile;
}
