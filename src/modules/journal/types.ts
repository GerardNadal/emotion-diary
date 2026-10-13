import type { Mood, Emotion, Category } from "./emotions";
export type JournalInput = {
  mood: Mood;
  emotion: Emotion;
  intensity: number;
  reflection: string;
  category: Category | null;
  reason: string | null;
  custom_reason: string;
  activity: string;
  reaction: string;
  support: string;
  occurred_at: string;
};
export type JournalEntry = JournalInput & {
  id: string;
  created_at: string;
  updated_at: string;
};
export type JournalQuery = {
  page: number;
  order: "asc" | "desc";
  from: string | null;
  to: string | null;
  emotion: Emotion | null;
  intensity: number | null;
  category: Category | null;
  timezone: string;
};
export type JournalPage = {
  entries: JournalEntry[];
  total: number;
  page: number;
  page_size: number;
};
export type JournalDay = {
  day: string;
  count: number;
  mood: Mood;
  emotion: Emotion;
  moods: Mood[];
  emotions: Emotion[];
};
export type JournalSummary = {
  latest: JournalEntry | null;
  days: JournalDay[];
  count: number;
};
