"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/modules/auth/session";
import { journalTimezone } from "@/modules/journal/evolution-actions";
import type { JournalEntry } from "@/modules/journal/types";
import { activityIds, type RecommendationResult } from "./contracts";
import { configuredAIProvider } from "./runtime";
import { requestRecommendation } from "./service";

export async function generateRecommendation(input: unknown): Promise<RecommendationResult> {
  const profile = await requireProfile();
  try {
    const client = await createClient();
    return await requestRecommendation(input, {
      userId: profile.id,
      async getEntry(id) {
        const { data, error } = await client.rpc("journal_get", { p_id: id });
        if (error) throw new Error("journal_unavailable");
        return data as unknown as JournalEntry | null;
      },
      async reserve(entryId) {
        const { data, error } = await client.rpc("ai_reserve", { p_entry_id: entryId });
        const parsed = z.discriminatedUnion("allowed", [
          z.object({ allowed: z.literal(true), token: z.uuid() }),
          z.object({ allowed: z.literal(false), reason: z.enum(["busy", "limit", "unavailable"]) }),
        ]).safeParse(data);
        return error || !parsed.success ? { allowed: false, reason: "unavailable" } : parsed.data;
      },
      async release(token) {
        const { error } = await client.rpc("ai_release", { p_token: token });
        if (error) throw new Error("release_unavailable");
      },
      provider: configuredAIProvider(),
    });
  } catch {
    return { ok: false, message: "No se ha podido consultar la entrada. Los recursos generales siguen disponibles; puedes reintentarlo." };
  }
}

export async function completeWellbeingActivity(id: unknown, timezone: unknown): Promise<{ ok: boolean; message: string }> {
  await requireProfile();
  if (!z.enum(activityIds).safeParse(id).success) return { ok: false, message: "Actividad no válida." };
  const tz = await journalTimezone(timezone);
  if (!tz.ok) return tz;
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("wellbeing_complete", { p_activity: id as string });
    if (error) return { ok: false, message: "No se ha podido registrar la actividad. Puedes reintentarlo." };
    revalidatePath("/insights"); revalidatePath("/employee"); revalidatePath("/journal", "layout");
    return { ok: true, message: data ? "Actividad realizada. Cuenta en tu día de actividad significativa." : "Esta actividad ya estaba registrada hoy. Cada día cuenta una sola vez para tu racha." };
  } catch {
    return { ok: false, message: "No se ha podido registrar la actividad. Puedes reintentarlo." };
  }
}
