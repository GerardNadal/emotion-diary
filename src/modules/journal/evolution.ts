import { z } from "zod";
import { journalQuerySchema, timezoneSchema } from "./validation";
import { shiftDay } from "./dates";
import type { Statistics } from "./evolution-types";

const date = journalQuerySchema.shape.from.unwrap().unwrap();
export const evolutionQuerySchema = z
  .object({
    timezone: timezoneSchema,
    period: z.enum(["7", "30", "90", "custom"]).default("30"),
    from: date.optional(),
    to: date.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.period === "custom" &&
      (!v.from ||
        !v.to ||
        v.from > v.to ||
        (Date.parse(v.to) - Date.parse(v.from)) / 86400000 >= 366 ||
        v.from < "1901-01-01" ||
        v.to >= "2200-01-01")
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Elige un período válido de hasta 366 días, entre 1901 y 2199.",
      });
  });
export function periodRange(
  query: z.infer<typeof evolutionQuerySchema>,
  today: string,
) {
  return query.period === "custom"
    ? { from: query.from!, to: query.to! }
    : { from: shiftDay(today, 1 - Number(query.period)), to: today };
}
export function descriptiveTrend(stats: Statistics) {
  const a = stats.current;
  const b = stats.previous;
  if (!a.entries)
    return "Todavía no hay registros en este período. Puedes empezar cuando te apetezca.";
  if (a.recorded_days < 3 || b.recorded_days < 3)
    return "Hay pocos días registrados para describir un cambio entre períodos. Cada momento cuenta, sin necesidad de completar los días vacíos.";
  const delta = a.mood_average! - b.mood_average!;
  return Math.abs(delta) < 0.25
    ? "El ánimo medio de tus días registrados es parecido al del período anterior. Los días sin registros no se incluyen en esta comparación."
    : `El ánimo medio de tus días registrados es ${delta > 0 ? "más alto" : "más bajo"} que en el período anterior. Es una descripción de tus registros, no una evaluación de tu bienestar.`;
}
