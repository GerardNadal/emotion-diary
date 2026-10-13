export const moods = [
  { value: "very-low", emoji: "😞", label: "Muy mal", color: "rose" },
  { value: "low", emoji: "🙁", label: "Mal", color: "peach" },
  { value: "neutral", emoji: "😐", label: "Neutral", color: "sand" },
  { value: "good", emoji: "🙂", label: "Bien", color: "sage" },
  { value: "very-good", emoji: "😄", label: "Muy bien", color: "mint" },
] as const;
export type Mood = (typeof moods)[number]["value"];

export const emotions = [
  { value: "sadness", emoji: "😢", label: "Tristeza" },
  { value: "joy", emoji: "😊", label: "Alegría" },
  { value: "anxiety", emoji: "😟", label: "Ansiedad" },
  { value: "calm", emoji: "😌", label: "Calma" },
  { value: "anger", emoji: "😠", label: "Enfado" },
] as const;
export type Emotion = (typeof emotions)[number]["value"];

export function parseMood(value: unknown): Mood | "" {
  return moods.find((mood) => mood.value === value)?.value ?? "";
}

export function newEntryForMood(mood: Mood) {
  return `/journal/new?mood=${mood}`;
}
export const reasonGroups = [
  {
    label: "En el trabajo",
    reasons: [
      "Carga de trabajo",
      "Reuniones",
      "Equipo",
      "Reconocimiento",
      "Cambios",
      "Otro motivo laboral",
    ],
  },
  {
    label: "Fuera del trabajo",
    reasons: [
      "Familia",
      "Amistades",
      "Salud",
      "Tiempo personal",
      "Finanzas",
      "Otro motivo personal",
    ],
  },
] as const;
