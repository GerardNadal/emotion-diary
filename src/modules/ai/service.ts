import { createHash } from "node:crypto";
import { recommendationRequestSchema, recommendationSchema, type RecommendationResult, type WellbeingProvider } from "./contracts";
import type { JournalEntry } from "../journal/types";
import { crisisRecommendation, localRecommendation } from "./resources";
import { crisisSignal, entryContext, sharedEntryText, unsafeAdvice } from "./safety";

type Reservation = { allowed: true; token: string } | { allowed: false; reason: "busy" | "limit" | "unavailable" };
export type AIDependencies = {
  userId: string;
  getEntry(id: string): Promise<JournalEntry | null>;
  reserve(entryId: string): Promise<Reservation>;
  release(token: string): Promise<void>;
  provider: WellbeingProvider | null;
};

// Bounded process-local cache; quota/concurrency are enforced in PostgreSQL.
// Input is never cached. Entries are physically removed after fifteen minutes.
export class RecommendationCache {
  private entries = new Map<string, { result: RecommendationResult; timer: ReturnType<typeof setTimeout> }>();
  constructor(private ttlMs = 15 * 60_000, private maxEntries = 200) {}
  get(key: string) { return this.entries.get(key)?.result; }
  set(key: string, result: RecommendationResult) {
    if (this.entries.has(key)) return;
    if (this.entries.size >= this.maxEntries) this.delete(this.entries.keys().next().value!);
    const timer = setTimeout(() => this.delete(key), this.ttlMs);
    timer.unref();
    this.entries.set(key, { result, timer });
  }
  private delete(key: string) {
    const item = this.entries.get(key);
    if (item) clearTimeout(item.timer);
    this.entries.delete(key);
  }
  clear() { for (const key of this.entries.keys()) this.delete(key); }
}
const defaultCache = new RecommendationCache();

export async function requestRecommendation(input: unknown, dependencies: AIDependencies, cache = defaultCache): Promise<RecommendationResult> {
  const parsed = recommendationRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Solicitud no válida. Selecciona una entrada propia." };
  // Recheck ownership and active identity BEFORE cache, even on a repeat request.
  const entry = await dependencies.getEntry(parsed.data.entryId);
  if (!entry) return { ok: false, message: "La entrada no está disponible o tu acceso ha cambiado." };
  const context = entryContext(entry, parsed.data.shareText);
  if (parsed.data.shareText && crisisSignal(sharedEntryText(entry))) {
    return { ok: true, data: crisisRecommendation(), source: "safety", notice: "Prioriza el apoyo humano. Esta orientación se muestra sin enviar tu texto a OpenAI.", cached: false };
  }
  const local = (notice: string): RecommendationResult => ({ ok: true, data: localRecommendation(context), source: "local", notice, cached: false });
  if (!dependencies.provider) return local("OpenAI no está configurado. Puedes usar esta alternativa local sin enviar datos fuera de Dentro.");
  const key = createHash("sha256").update(JSON.stringify(["quotes-v3-natural-tone", dependencies.userId, entry.id, entry.updated_at, parsed.data.shareText, context])).digest("hex");
  const cached = cache.get(key);
  if (cached?.ok) return { ...cached, cached: true };
  const reservation = await dependencies.reserve(entry.id);
  if (!reservation.allowed) {
    return local(reservation.reason === "busy" ? "Ya hay una solicitud en curso. Espera a que termine; mientras tanto tienes esta alternativa local." : reservation.reason === "limit" ? "Has alcanzado el límite temporal de solicitudes. Puedes seguir con los recursos locales y reintentarlo más tarde." : "El servicio de IA no está disponible. Puedes seguir con esta alternativa local.");
  }
  try {
    const generated = await dependencies.provider.generate(context);
    const validated = recommendationSchema.parse(generated.data);
    if (unsafeAdvice(JSON.stringify(validated))) throw new Error("unsafe_output");
    // Revocation/deletion during generation must also prevent result delivery.
    const current = await dependencies.getEntry(entry.id);
    if (!current || current.updated_at !== entry.updated_at) return { ok: false, message: "La entrada o tu acceso han cambiado. Vuelve a abrirla antes de solicitar una recomendación." };
    const result: RecommendationResult = {
      ok: true, data: generated.safety || validated.crisis ? crisisRecommendation() : validated, source: generated.safety || validated.crisis ? "safety" : "openai", cached: false,
      notice: generated.safety || validated.crisis ? "Prioriza el apoyo humano. Mostramos orientación de ayuda preparada por Dentro." : "Sugerencia de GPT. Tú decides si te encaja; no sustituye atención profesional.",
    };
    if (result.ok && result.source === "openai") cache.set(key, result);
    return result;
  } catch {
    const current = await dependencies.getEntry(entry.id);
    if (!current || current.updated_at !== entry.updated_at) return { ok: false, message: "La entrada o tu acceso han cambiado. Vuelve a abrirla antes de solicitar una recomendación." };
    return local("No se ha podido obtener la respuesta de OpenAI. Tienes una alternativa local y puedes reintentarlo más tarde.");
  } finally {
    // A failed release is safe: the short DB lease expires on its own.
    try { await dependencies.release(reservation.token); } catch { /* no sensitive logs */ }
  }
}
