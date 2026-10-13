import { z } from "zod";
import { emotions, moods, reasonGroups } from "./emotions";
const category = z.enum(reasonGroups.map((g) => g.value));
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Fecha no válida",
  );
export const timezoneSchema = z
  .string()
  .max(100)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("es", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Zona horaria no válida");
export const journalInputSchema = z
  .object({
    mood: z.enum(
      moods.map((m) => m.value),
      { error: "Elige un estado de ánimo." },
    ),
    emotion: z.enum(
      emotions.map((e) => e.value),
      { error: "Elige una emoción." },
    ),
    intensity: z.number().int().min(1).max(5),
    reflection: z.string().trim().max(2000),
    category: category.nullable(),
    reason: z.string().max(80).nullable(),
    custom_reason: z.string().trim().max(250),
    activity: z.string().trim().max(250),
    reaction: z.string().trim().max(1000),
    support: z.string().trim().max(1000),
    occurred_at: z.iso
      .datetime({ offset: true })
      .refine((v) => Number.isFinite(Date.parse(v)), "Fecha y hora no válidas"),
  })
  .strict()
  .superRefine((v, ctx) => {
    const group = reasonGroups.find((g) => g.value === v.category);
    if (v.reason && !group?.reasons.some((r) => r.value === v.reason))
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "El motivo debe pertenecer a la categoría.",
      });
    if (v.custom_reason && !v.category)
      ctx.addIssue({
        code: "custom",
        path: ["category"],
        message: "Elige una categoría para tu motivo personalizado.",
      });
  });
export const journalQuerySchema = z
  .object({
    page: z.number().int().min(1).max(100000).default(1),
    order: z.enum(["asc", "desc"]).default("desc"),
    from: date.nullable().default(null),
    to: date.nullable().default(null),
    emotion: z
      .enum(emotions.map((e) => e.value))
      .nullable()
      .default(null),
    intensity: z.number().int().min(1).max(5).nullable().default(null),
    category: category.nullable().default(null),
    timezone: timezoneSchema,
  })
  .strict()
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "El inicio debe ser anterior al final del período.",
  );
export const entryIdSchema = z.uuid();
export const deleteIdsSchema = z
  .array(entryIdSchema)
  .min(1)
  .max(12)
  .refine((ids) => new Set(ids).size === ids.length);
