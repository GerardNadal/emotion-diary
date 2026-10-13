import type { EmotionalContext } from "./contracts";

export const quoteIds = ["control", "self", "hope", "enthusiasm", "freedom"] as const;
export type QuoteId = typeof quoteIds[number];
type Quote = { text: string; author: string; work: string; source: string; translated: boolean; themes: string };

// Reviewed excerpts from the linked works. Spanish translations are ours;
// the model selects an ID and cannot generate text, attribution or source URLs.
export const wellbeingQuotes: Record<QuoteId, Quote> = {
  control: {
    text: "Hay cosas que están en nuestro poder y otras que están fuera de él.",
    author: "Epicteto", work: "Enquiridión, I", translated: true,
    source: "https://www.gutenberg.org/cache/epub/45109/pg45109-images.html",
    themes: "incertidumbre, frustración, límites y distinguir qué depende de uno",
  },
  self: {
    text: "Lo más grande del mundo es saber que uno se pertenece.",
    author: "Michel de Montaigne", work: "Ensayos, De la soledad", translated: true,
    source: "https://www.gutenberg.org/files/3600/3600-h/3600-h.htm",
    themes: "descanso, espacio propio, calma y cuidado personal",
  },
  hope: {
    text: "La esperanza es esa cosa con plumas que se posa en el alma.",
    author: "Emily Dickinson", work: "Poems, Series Two, Hope", translated: true,
    source: "https://www.gutenberg.org/cache/epub/2679/pg2679-images.html",
    themes: "tristeza, desánimo y esperanza sin exigir sentirse bien",
  },
  enthusiasm: {
    text: "Nunca se logró nada grande sin entusiasmo.",
    author: "Ralph Waldo Emerson", work: "Essays, Circles", translated: true,
    source: "https://www.gutenberg.org/files/16643/16643-h/16643-h.htm",
    themes: "alegría, ilusión y celebrar algo que ya ha sucedido; no usar ante sobrecarga",
  },
  freedom: {
    text: "La libertad, Sancho, es uno de los más preciosos dones que a los hombres dieron los cielos.",
    author: "Miguel de Cervantes", work: "Don Quijote, II, LVIII", translated: false,
    source: "https://cvc.cervantes.es/literatura/clasicos/quijote/edicion/parte2/cap58/default.htm",
    themes: "autonomía, conciliación y desconexión del trabajo",
  },
};

export function localQuoteId(context: EmotionalContext): QuoteId {
  const content = [context.mood, context.emotion, context.category, context.reason, ...Object.values(context.text ?? {})].join(" ").toLocaleLowerCase("es");
  if (/desconexión|conciliación|autonomía/.test(content)) return "freedom";
  if (/carga de trabajo|incertidumbre|conflicto|ansios|enfadad|frustración/.test(content)) return "control";
  if (/trist|desánimo|duelo/.test(content)) return "hope";
  if (/feliz|emocionad|celebrando|logro|alegría/.test(content)) return "enthusiasm";
  return "self";
}
