"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/modules/auth/session";
import { timezoneSchema } from "./validation";
import { evolutionQuerySchema, periodRange } from "./evolution";
import type { Evolution, Progress } from "./evolution-types";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };
const failure = {
  ok: false as const,
  message: "No se ha podido consultar tu evolución. Puedes reintentarlo.",
};

export async function journalTimezone(
  timezone: unknown,
  replace = false,
): Promise<Result<string>> {
  await requireProfile();
  const parsed = timezoneSchema.safeParse(timezone);
  if (!parsed.success || typeof replace !== "boolean")
    return { ok: false, message: "Zona horaria no válida." };
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("journal_preferences", {
      p_timezone: parsed.data,
      p_replace: replace,
    });
    if (error || !data) return failure;
    if (replace) {
      revalidatePath("/insights");
      revalidatePath("/employee");
      revalidatePath("/journal", "layout");
    }
    return { ok: true, data };
  } catch {
    return failure;
  }
}

export async function personalProgress(
  timezone: unknown,
  month?: string,
): Promise<Result<Progress>> {
  await requireProfile();
  if (month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    return { ok: false, message: "Mes no válido." };
  const tz = await journalTimezone(timezone);
  if (!tz.ok) return tz;
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("journal_progress", {
      ...(month ? { p_month: `${month}-01` } : {}),
    });
    if (error || !data) return failure;
    return { ok: true, data: data as unknown as Progress };
  } catch {
    return failure;
  }
}

export async function personalEvolution(
  input: unknown,
): Promise<Result<Evolution>> {
  await requireProfile();
  const parsed = evolutionQuerySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0].message };
  const progress = await personalProgress(parsed.data.timezone);
  if (!progress.ok) return progress;
  try {
    const client = await createClient();
    const range = periodRange(parsed.data, progress.data.today);
    const { data, error } = await client.rpc("journal_statistics", {
      p_from: range.from,
      p_to: range.to,
    });
    if (error || !data) return failure;
    return {
      ok: true,
      data: {
        progress: progress.data,
        statistics: data as unknown as Evolution["statistics"],
      },
    };
  } catch {
    return failure;
  }
}
