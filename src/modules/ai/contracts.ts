import { z } from "zod";
import { quoteIds } from "./quotes";

export const activityIds = ["pause", "screen", "planning", "movement", "reflection", "communication", "disconnect"] as const;
export const recommendationRequestSchema = z.object({
  entryId: z.uuid(),
  shareText: z.boolean(),
}).strict();
export const recommendationSchema = z.object({
  crisis: z.boolean(),
  reflection: z.string().min(1).max(450),
  advice: z.string().min(1).max(450),
  activity: z.object({ id: z.enum(activityIds), reason: z.string().min(1).max(250) }).strict(),
  accompaniment: z.string().min(1).max(250),
  quoteId: z.enum(quoteIds),
  music: z.array(z.object({
    title: z.string().min(1).max(100),
    artist: z.string().min(1).max(100),
    reason: z.string().min(1).max(180),
  }).strict()).length(3),
}).strict();
export type Recommendation = z.infer<typeof recommendationSchema>;
export type ActivityId = typeof activityIds[number];
export type EmotionalContext = {
  mood: string; emotion: string; intensity: number; category: string; reason: string;
  text?: { reflection: string; customReason: string; activity: string; reaction: string };
};
export type RecommendationResult =
  | { ok: true; data: Recommendation; source: "openai" | "local" | "safety"; notice: string; cached: boolean }
  | { ok: false; message: string };
export type TechnicalMetric = {
  event: "ai_usage"; model: string; elapsedMs: number;
  inputTokens: number; outputTokens: number;
  outcome: "success" | "safety" | "unavailable" | "timeout" | "invalid" | "error";
};
export interface WellbeingProvider {
  generate(context: EmotionalContext): Promise<{ data: Recommendation; safety: boolean }>;
}
