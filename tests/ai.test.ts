import assert from "node:assert/strict";
import { test } from "node:test";
import type { JournalEntry } from "../src/modules/journal/types";
import { RecommendationCache, requestRecommendation, type AIDependencies } from "../src/modules/ai/service";
import { localRecommendation } from "../src/modules/ai/resources";
import { crisisSignal, entryContext, minimizeText } from "../src/modules/ai/safety";
import { recommendationSchema, type EmotionalContext, type TechnicalMetric } from "../src/modules/ai/contracts";
import { createOpenAIProvider } from "../src/modules/ai/openai-provider";
import { localQuoteId, wellbeingQuotes } from "../src/modules/ai/quotes";
import { emotions } from "../src/modules/journal/emotions";

const entry: JournalEntry = {
  id: "a6100000-0000-4000-8000-000000000001", mood: "low", emotion: "anxiety", intensity: 4,
  category: "work", reason: "workload", reflection: "María me escribió desde maria@example.test", custom_reason: "Proyecto Privado",
  activity: "caminar", reaction: "me quedé en silencio", support: "solo privado", occurred_at: "2026-10-13T09:00:00Z",
  created_at: "2026-10-13T09:00:00Z", updated_at: "2026-10-13T09:00:00Z",
};
const context = entryContext(entry, false);
const valid = localRecommendation(context);
function setup(overrides: Partial<AIDependencies> = {}) {
  let calls = 0, releases = 0;
  const received: EmotionalContext[] = [];
  const deps: AIDependencies = {
    userId: "owner", getEntry: async id => id === entry.id ? entry : null,
    reserve: async () => ({ allowed: true, token: "token" }), release: async () => { releases++; },
    provider: { async generate(ctx) { calls++; received.push(ctx); return { data: valid, safety: false }; } }, ...overrides,
  };
  return { deps, received, calls: () => calls, releases: () => releases };
}
const request = { entryId: entry.id, shareText: false };

test("AI: unknown fields, forged identity, boolean coercion and arbitrary prompts are rejected", async () => {
  const s = setup();
  for (const input of [{ ...request, userId: "victim" }, { ...request, prompt: "injected" }, { ...request, shareText: "true" }, { ...request, entryId: "bad" }]) {
    assert.equal((await requestRecommendation(input, s.deps)).ok, false);
  }
  assert.equal(s.calls(), 0);
});

test("AI: quotes use reviewed IDs, reject fabricated attributions, and fall back safely", async () => {
  assert.equal(recommendationSchema.safeParse({ ...valid, quoteId: "invented-author" }).success, false);
  assert.equal(recommendationSchema.safeParse({ ...valid, quote: { text: "Invented quote", author: "Invented author" } }).success, false);
  const { quoteId: removed, ...withoutQuote } = valid;
  assert.ok(removed);
  assert.equal(recommendationSchema.safeParse(withoutQuote).success, false);
  const s = setup({ provider: { generate: async () => ({ data: { ...valid, quoteId: "invented-author" } as never, safety: false }) } });
  const cache = new RecommendationCache();
  try {
    const result = await requestRecommendation(request, s.deps, cache);
    assert.ok(result.ok && result.source === "local");
    if (result.ok) assert.ok(wellbeingQuotes[result.data.quoteId].author);
    assert.equal(s.releases(), 1);
  } finally { cache.clear(); }
});

test("AI: local quotes match the emotional context without requiring the provider", () => {
  assert.equal(localQuoteId(context), "control");
  assert.equal(localQuoteId({ ...context, emotion: "Feliz", reason: "Logro", category: "", text: undefined }), "enthusiasm");
  assert.equal(localQuoteId({ ...context, emotion: "Triste", reason: "", category: "", text: undefined }), "hope");
  assert.equal(localQuoteId({ ...context, reason: "Desconexión del trabajo" }), "freedom");
  assert.equal(localQuoteId({ mood: "Neutral", emotion: "En paz", category: "", reason: "", intensity: 2 }), "self");
});

test("AI: fallback support responds to feelings without describing the app as a companion", () => {
  for (const emotion of emotions) {
    const result = localRecommendation({ ...context, emotion: emotion.label });
    assert.ok(recommendationSchema.safeParse(result).success);
    assert.doesNotMatch(`${result.reflection} ${result.accompaniment}`, /diario|dentro|herramienta|aplicaci[oó]n|este espacio|te acoge|te acompa[ñn]o|estoy aqu[ií]|sin juzgar|estar presente/i);
    assert.notEqual(result.reflection, result.accompaniment);
  }
});
test("AI: ownership is checked before cache, and separate users never reuse another recommendation", async () => {
  const cache = new RecommendationCache(); const s = setup();
  try {
    assert.equal((await requestRecommendation(request, s.deps, cache)).ok, true);
    const denied = setup({ userId: "admin", getEntry: async () => null });
    assert.equal((await requestRecommendation(request, denied.deps, cache)).ok, false);
    assert.equal(denied.calls(), 0);
    const other = setup({ userId: "another" });
    await requestRecommendation(request, other.deps, cache); assert.equal(other.calls(), 1);
  } finally { cache.clear(); }
});
test("AI: minimized context excludes identifiers, timestamps, support and all unconsented free text", async () => {
  const s = setup(); const cache = new RecommendationCache();
  try {
    await requestRecommendation(request, s.deps, cache);
    assert.deepEqual(Object.keys(s.received[0]).sort(), ["category", "emotion", "intensity", "mood", "reason"]);
    await requestRecommendation({ ...request, shareText: true }, s.deps, cache);
    assert.equal(s.received[1].text?.activity, "caminar");
    const json = JSON.stringify(s.received);
    for (const privateValue of ["María", "maria@example.test", "Proyecto Privado", entry.id, entry.updated_at, entry.support]) assert.ok(!json.includes(privateValue));
    assert.ok(!minimizeText("Contacto +34 612 345 678 https://private.test @persona").includes("612"));
  } finally { cache.clear(); }
});
test("AI: cache deduplicates, expires physically, and invalidates on entry edit or consent change", async () => {
  const s = setup(); const cache = new RecommendationCache(10);
  try {
    await requestRecommendation(request, s.deps, cache);
    const repeated = await requestRecommendation(request, s.deps, cache);
    assert.ok(repeated.ok && repeated.cached); assert.equal(s.calls(), 1);
    s.deps.getEntry = async () => ({ ...entry, updated_at: "2026-10-13T10:00:00Z" });
    await requestRecommendation(request, s.deps, cache); assert.equal(s.calls(), 2);
    await new Promise(resolve => setTimeout(resolve, 20));
    await requestRecommendation(request, s.deps, cache); assert.equal(s.calls(), 3);
  } finally { cache.clear(); }
});
test("AI: no credentials, unavailable quotas, limits and busy requests offer local resources without generation", async () => {
  for (const reason of ["busy", "limit", "unavailable"] as const) {
    const s = setup({ reserve: async () => ({ allowed: false, reason }) });
    const result = await requestRecommendation(request, s.deps, new RecommendationCache());
    assert.ok(result.ok && result.source === "local"); assert.equal(s.calls(), 0);
  }
  const s = setup({ provider: null, reserve: async () => { throw new Error("must not reserve"); } });
  assert.ok((await requestRecommendation(request, s.deps)).ok);
});
test("AI: simultaneous requests cannot trigger duplicate generation", async () => {
  let reserved = false, calls = 0; const cache = new RecommendationCache();
  const s = setup({
    reserve: async () => { if (reserved) return { allowed: false, reason: "busy" }; reserved = true; return { allowed: true, token: "one" }; },
    provider: { async generate() { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return { data: valid, safety: false }; } },
  });
  try {
    await Promise.all(Array.from({ length: 8 }, () => requestRecommendation(request, s.deps, cache)));
    assert.equal(calls, 1); assert.equal(s.releases(), 1);
  } finally { cache.clear(); }
});
test("AI: failures and invalid provider output release reservations and never cache the failure", async () => {
  for (const provider of [
    { generate: async () => { throw new Error("private error with body"); } },
    { generate: async () => ({ data: { ...valid, music: [] }, safety: false }) },
    { generate: async () => ({ data: { ...valid, advice: "Deja la medicación" }, safety: false }) },
  ]) {
    const s = setup({ provider }); const cache = new RecommendationCache();
    const result = await requestRecommendation(request, s.deps, cache);
    assert.ok(result.ok && result.source === "local"); assert.equal(s.releases(), 1);
    assert.ok(!JSON.stringify(result).includes("private error"));
    cache.clear();
  }
});
test("AI: deletion or revocation while waiting discards the generated answer", async () => {
  let reads = 0;
  const s = setup({ getEntry: async () => ++reads === 1 ? entry : null });
  assert.equal((await requestRecommendation(request, s.deps, new RecommendationCache())).ok, false);
  assert.equal(s.releases(), 1);
});
test("AI: local crisis routing needs consent, never sends text, and model risk cannot render free crisis advice", async () => {
  assert.ok(crisisSignal("Quiero quitarme la vida")); assert.ok(crisisSignal("I want to die"));
  const s = setup({ getEntry: async () => ({ ...entry, reflection: "quiero hacerme daño" }) });
  const result = await requestRecommendation({ ...request, shareText: true }, s.deps);
  assert.ok(result.ok && result.source === "safety" && result.data.crisis); assert.equal(s.calls(), 0);
  const model = setup({ provider: { generate: async () => ({ data: { ...valid, crisis: true, advice: "Texto arbitrario" }, safety: false }) } });
  const routed = await requestRecommendation(request, model.deps, new RecommendationCache());
  assert.ok(routed.ok && routed.source === "safety" && !routed.data.advice.includes("arbitrario"));
});
test("AI: exactly three bounded songs, safe catalog activities, and incomplete response rejection", () => {
  assert.ok(recommendationSchema.safeParse(valid).success);
  assert.equal(recommendationSchema.safeParse({ ...valid, music: valid.music.slice(1) }).success, false);
  assert.equal(recommendationSchema.safeParse({ ...valid, activity: { id: "dangerous", reason: "x" } }).success, false);
  assert.equal(recommendationSchema.safeParse({ ...valid, reflection: "" }).success, false);
});

function sdkFetch(options: { status?: string; invalid?: boolean; refusal?: boolean; risk?: boolean; fail?: number; delay?: boolean } = {}) {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const mock: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    if (options.delay) return await new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    });
    if (options.fail) return new Response(JSON.stringify({ error: { message: "sensitive content must not leak" } }), { status: options.fail });
    if (String(url).includes("moderations")) return Response.json({ id: "mod", model: "omni-moderation-latest", results: [{ flagged: !!options.risk, categories: { "self-harm": !!options.risk } }] });
    return Response.json({ id: "resp", status: options.status ?? "completed", object: "response", output: [{ id: "msg", type: "message", role: "assistant", status: "completed", content: [options.refusal ? { type: "refusal", refusal: "Cannot comply" } : { type: "output_text", text: options.invalid ? "{}" : JSON.stringify(valid), annotations: [] }] }], usage: { input_tokens: 400, output_tokens: 300, total_tokens: 700 } });
  };
  return { mock, requests };
}
test("OpenAI SDK: Responses JSON schema, store false, token cap, no identity or conversation state, technical-only metrics", async () => {
  const s = sdkFetch(); const metrics: TechnicalMetric[] = [];
  const provider = createOpenAIProvider({ apiKey: "test-only", fetch: s.mock, metric: m => metrics.push(m) });
  const result = await provider.generate(context);
  assert.deepEqual(result.data, valid);
  const body = s.requests.find(r => r.url.includes("responses"))!.body;
  assert.equal(body.store, false); assert.equal(body.max_output_tokens, 1000); assert.equal(body.model, "gpt-4.1-mini");
  assert.equal((body.text as { format: { type: string; strict: boolean } }).format.type, "json_schema");
  assert.equal((body.text as { format: { strict: boolean } }).format.strict, true);
  for (const field of ["user", "metadata", "previous_response_id", "conversation", "tools"]) assert.ok(!(field in body));
  assert.deepEqual(Object.keys(metrics[0]).sort(), ["elapsedMs", "event", "inputTokens", "model", "outcome", "outputTokens"]);
  assert.equal(metrics[0].inputTokens, 400); assert.equal(metrics[0].outcome, "success");
});
test("OpenAI SDK: incomplete JSON, refusals, malformed output and API errors are rejected", async () => {
  for (const options of [{ status: "incomplete" }, { invalid: true }, { refusal: true }, { fail: 500 }]) {
    const s = sdkFetch(options); const provider = createOpenAIProvider({ apiKey: "test-only", fetch: s.mock });
    await assert.rejects(provider.generate(context));
    if (options.fail) assert.equal(s.requests.length, 1);
  }
});
test("OpenAI SDK: moderation routes self-harm to deterministic help without any GPT request", async () => {
  const s = sdkFetch({ risk: true }); const provider = createOpenAIProvider({ apiKey: "test-only", fetch: s.mock });
  const result = await provider.generate(context);
  assert.ok(result.safety && result.data.crisis); assert.equal(s.requests.length, 1);
});
test("OpenAI SDK: only one explicit retry for transient Responses errors, never uncontrolled SDK retries", async () => {
  for (const failures of [1, 2]) {
    const s = sdkFetch(); let attempts = 0;
    const transport: typeof fetch = async (url, init) => {
      if (String(url).includes("responses") && ++attempts <= failures)
        return Response.json({ error: { message: "transient" } }, { status: 503 });
      return s.mock(url, init);
    };
    const provider = createOpenAIProvider({ apiKey: "test-only", fetch: transport });
    if (failures === 1) assert.deepEqual((await provider.generate(context)).data, valid);
    else await assert.rejects(provider.generate(context));
    assert.equal(attempts, 2);
  }
});
test("OpenAI SDK: unsafe output flagged by moderation is rejected before delivery", async () => {
  const s = sdkFetch(); let moderationCalls = 0;
  const transport: typeof fetch = async (url, init) => {
    if (String(url).includes("moderations") && ++moderationCalls === 2)
      return Response.json({ results: [{ flagged: true, categories: {} }] });
    return s.mock(url, init);
  };
  const provider = createOpenAIProvider({ apiKey: "test-only", fetch: transport });
  await assert.rejects(provider.generate(context));
  assert.equal(moderationCalls, 2);
});
test("OpenAI SDK: shared deadline aborts, does not retry ambiguous requests, and reports no error bodies", async () => {
  const s = sdkFetch({ delay: true }); const metrics: TechnicalMetric[] = [];
  const provider = createOpenAIProvider({ apiKey: "test-only", fetch: s.mock, timeoutMs: 20, metric: m => metrics.push(m) });
  // Keep the test process alive while the native AbortSignal timer is unreferenced.
  const hold = setInterval(() => {}, 1000);
  try { await assert.rejects(provider.generate(context)); } finally { clearInterval(hold); }
  assert.equal(metrics[0].outcome, "timeout"); assert.equal(s.requests.length, 1);
});
