import { z } from "zod";
export const reportingQuery = z.object({ team: z.uuid().nullable(), period: z.iso.date(), grain: z.enum(["month", "quarter"]) }).strict();
export type ReportingQuery = z.infer<typeof reportingQuery>;
const percent = z.number().min(0).max(100);
const withheld = z.object({ status: z.literal("insufficient_data") }).strict();
const dimension = z.union([withheld, z.object({ status: z.literal("published"), values: z.array(z.object({ value: z.string(), percent }).strict()) }).strict()]);
export const collectiveData = z.union([withheld, z.object({
  status: z.literal("published"),
  dimensions: z.object({ mood: dimension, emotion: dimension, intensity: dimension, factor: dimension, reason: dimension }).strict(),
  participation: z.union([withheld, z.object({ status: z.literal("published"), percent }).strict()]),
}).strict()]);
export const collectiveDashboard = z.object({
  period: z.iso.date(), grain: z.enum(["month", "quarter"]), current: collectiveData, previous: collectiveData,
  timeline: z.array(z.object({ period: z.iso.date(), data: collectiveData }).strict()).length(6),
  teams: z.array(z.object({ name: z.string(), data: collectiveData }).strict()),
  coverage: z.enum(["selected_team", "publishable_teams"]),
}).strict();
export type CollectiveData = z.infer<typeof collectiveData>;
export type CollectiveDashboard = z.infer<typeof collectiveDashboard>;
export type DimensionKind = "mood" | "emotion" | "intensity" | "factor" | "reason";
export type ReportingResult = { data: CollectiveDashboard | null; error: string | null };
export function allowedPeriods(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value) - 1;
  const options: { period: string; grain: ReportingQuery["grain"]; label: string }[] = [];
  for (let offset = 1; offset <= 24; offset++) {
    const d = new Date(Date.UTC(year, month - offset, 1));
    options.push({ period: d.toISOString().slice(0, 10), grain: "month", label: new Intl.DateTimeFormat("es", { month: "long", year: "numeric", timeZone: "UTC" }).format(d) });
  }
  for (let offset = 1; offset <= 8; offset++) {
    const d = new Date(Date.UTC(year, Math.floor(month / 3) * 3 - offset * 3, 1));
    if (d < new Date(Date.UTC(year, month - 24, 1))) continue;
    options.push({ period: d.toISOString().slice(0, 10), grain: "quarter", label: `${Math.floor(d.getUTCMonth() / 3) + 1}.º trimestre ${d.getUTCFullYear()}` });
  }
  return options;
}
export function publishedValues(data: CollectiveData, kind: DimensionKind) {
  if (data.status !== "published") return null;
  const dimension = data.dimensions[kind];
  return dimension.status === "published" ? dimension.values : null;
}
export function positiveShare(data: CollectiveData) {
  const values = publishedValues(data, "mood");
  return values ? Math.min(100, values.filter((v) => ["good", "very-good"].includes(v.value)).reduce((sum, v) => sum + v.percent, 0)) : null;
}
export function collectiveTrend(current: CollectiveData, previous: CollectiveData) {
  const a = positiveShare(current); const b = positiveShare(previous);
  if (a === null || b === null) return "La comparación necesita dos períodos publicables. Los huecos no equivalen a un ánimo neutral.";
  const delta = a - b;
  if (Math.abs(delta) < 20) return "La proporción aproximada de ánimo favorable se mantiene sin una variación amplia. No es una evaluación de personas.";
  return `${delta > 0 ? "Aumenta" : "Disminuye"} la proporción aproximada de ánimo favorable respecto al período anterior. Es una tendencia colectiva descriptiva, no una causa ni un diagnóstico.`;
}
