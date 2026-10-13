import type { JournalEntry } from "../journal/types";
import { moods, emotions, categoryLabel, reasonLabel } from "../journal/emotions";
import type { EmotionalContext } from "./contracts";

// Conservative local signal, supplemented by moderation and structured risk.
// It is a routing guard, never a diagnosis or a complete risk assessment.
export function crisisSignal(text: string) {
  const normalized = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return /suicid|autoles|matarme|quitarme la vida|acabar con mi vida|hacerme dano|lastimarme|no quiero (?:seguir )?vivir|no puedo seguir|desaparecer para siempre|self[ -]?harm|kill myself|end my life|want to die/.test(normalized);
}

// Removes obvious identifiers, including capitalized tokens conservatively.
// Cannot guarantee anonymization: the UI also asks for identifier-free text.
export function minimizeText(text: string) {
  return text.normalize("NFKC")
    .replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|@[\w.-]+/gi, "[dato omitido]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[dato omitido]")
    .replace(/\+?\d[\d\s()./-]{5,}\d/g, "[dato omitido]")
    .replace(/\b\d{6,}[a-z]?\b/gi, "[dato omitido]")
    .replace(/\p{Lu}[\p{L}\p{M}]*/gu, "[dato omitido]")
    .replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 1200);
}

export function entryContext(entry: JournalEntry, shareText: boolean): EmotionalContext {
  return {
    mood: moods.find(m => m.value === entry.mood)?.label ?? "Sin especificar",
    emotion: emotions.find(e => e.value === entry.emotion)?.label ?? "Sin especificar",
    intensity: entry.intensity,
    category: categoryLabel(entry.category), reason: reasonLabel(entry.reason),
    ...(shareText ? { text: {
      reflection: minimizeText(entry.reflection), customReason: minimizeText(entry.custom_reason),
      activity: minimizeText(entry.activity), reaction: minimizeText(entry.reaction),
    } } : {}),
  };
}

export function sharedEntryText(entry: JournalEntry) {
  return [entry.reflection, entry.custom_reason, entry.activity, entry.reaction].join("\n");
}

export function unsafeAdvice(text: string) {
  return /(?:te diagnostico|tienes (?:depresión|un trastorno)|debes tomar|toma \d+\s*mg|deja (?:tu |la )?medicación|garantizo|curará|soy tu terapeuta|no (?:pidas|busques) ayuda|ret[eé]n (?:el aire|la respiración))/i.test(text);
}
