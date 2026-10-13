"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/modules/auth/session";
import { journalTimezone } from "./evolution-actions";
import {
  journalInputSchema,
  journalQuerySchema,
  entryIdSchema,
  deleteIdsSchema,
} from "./validation";
import type {
  JournalEntry,
  JournalPage,
  JournalDay,
  JournalSummary,
} from "./types";
type Result<T> = { ok: true; data: T } | { ok: false; message: string };
function message(code?: string) {
  if (code === "42501")
    return "La entrada no está disponible o tu acceso ha cambiado.";
  if (["23514", "23503", "22023", "22007", "22008"].includes(code ?? ""))
    return "Revisa los datos, la fecha y el motivo seleccionado.";
  return "No se ha podido conectar con tu diario. Tu contenido sigue en el formulario; puedes reintentarlo.";
}
function refresh() {
  revalidatePath("/journal", "layout");
  revalidatePath("/employee");
  revalidatePath("/insights");
}
export async function saveEntry(
  id: unknown,
  input: unknown,
  create: boolean,
  timezone: unknown = "UTC",
): Promise<Result<JournalEntry>> {
  await requireProfile();
  const parsed = journalInputSchema.safeParse(input);
  if (!entryIdSchema.safeParse(id).success || typeof create !== "boolean")
    return { ok: false, message: "Entrada no válida." };
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0].message };
  const tz = await journalTimezone(timezone);
  if (!tz.ok) return tz;
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("journal_save", {
      p_id: id as string,
      p_entry: parsed.data,
      p_create: create,
    });
    if (error) return { ok: false, message: message(error.code) };
    if (!data) return { ok: false, message: message() };
    refresh();
    return { ok: true, data: data as unknown as JournalEntry };
  } catch {
    return { ok: false, message: message() };
  }
}
export async function getEntry(
  id: unknown,
): Promise<Result<JournalEntry | null>> {
  await requireProfile();
  if (!entryIdSchema.safeParse(id).success)
    return { ok: false, message: "Entrada no válida." };
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("journal_get", {
      p_id: id as string,
    });
    if (error) return { ok: false, message: message(error.code) };
    return { ok: true, data: data as unknown as JournalEntry | null };
  } catch {
    return { ok: false, message: message() };
  }
}
export async function listEntries(
  input: unknown,
): Promise<Result<JournalPage>> {
  await requireProfile();
  const parsed = journalQuerySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0].message };
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("journal_list", {
      p_query: parsed.data,
    });
    if (error || !data) return { ok: false, message: message(error?.code) };
    return { ok: true, data: data as unknown as JournalPage };
  } catch {
    return { ok: false, message: message() };
  }
}
export async function calendarDays(
  input: unknown,
): Promise<Result<JournalDay[]>> {
  await requireProfile();
  const parsed = journalQuerySchema.safeParse(input);
  if (
    !parsed.success ||
    !parsed.data.from ||
    !parsed.data.to ||
    (Date.parse(parsed.data.to) - Date.parse(parsed.data.from)) / 86400000 > 41
  )
    return { ok: false, message: "Elige un mes válido para el calendario." };
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("journal_days", {
      p_query: parsed.data,
    });
    if (error || !data) return { ok: false, message: message(error?.code) };
    return { ok: true, data: data as unknown as JournalDay[] };
  } catch {
    return { ok: false, message: message() };
  }
}
export async function journalSummary(
  input: unknown,
): Promise<Result<JournalSummary>> {
  await requireProfile();
  const parsed = journalQuerySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Período no válido." };
  const [days, latest] = await Promise.all([
    calendarDays(parsed.data),
    listEntries({
      ...parsed.data,
      from: null,
      to: null,
      page: 1,
      order: "desc",
    }),
  ]);
  if (!days.ok) return days;
  if (!latest.ok) return latest;
  return {
    ok: true,
    data: {
      latest: latest.data.entries[0] ?? null,
      days: days.data,
      count: days.data.reduce((sum, d) => sum + d.count, 0),
    },
  };
}
export async function deleteEntries(ids: unknown): Promise<Result<number>> {
  await requireProfile();
  const parsed = deleteIdsSchema.safeParse(ids);
  if (!parsed.success)
    return { ok: false, message: "Selecciona entre 1 y 12 entradas." };
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("journal_delete", {
      p_ids: parsed.data,
    });
    if (error) return { ok: false, message: message(error.code) };
    refresh();
    return { ok: true, data: data ?? 0 };
  } catch {
    return {
      ok: false,
      message:
        "No se ha podido eliminar. Actualiza el historial y vuelve a intentarlo.",
    };
  }
}
