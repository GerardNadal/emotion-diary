export const moods = [
  { value: "very-low", emoji: "😞", label: "Muy mal", color: "rose" },
  { value: "low", emoji: "🙁", label: "Mal", color: "peach" },
  { value: "neutral", emoji: "😐", label: "Neutral", color: "sand" },
  { value: "good", emoji: "🙂", label: "Bien", color: "sage" },
  { value: "very-good", emoji: "😄", label: "Muy bien", color: "mint" },
] as const;
export type Mood = (typeof moods)[number]["value"];

export const emotions = [
  { value: "joy", emoji: "😊", label: "Feliz" },
  { value: "sadness", emoji: "😢", label: "Triste" },
  { value: "anger", emoji: "😠", label: "Enfadado" },
  { value: "calm", emoji: "😌", label: "Tranquilo" },
  { value: "excitement", emoji: "🤩", label: "Emocionado" },
  { value: "loved", emoji: "🥰", label: "Amado" },
  { value: "celebration", emoji: "🥳", label: "Celebrando" },
  { value: "anxiety", emoji: "😟", label: "Ansioso" },
  { value: "peace", emoji: "🕊️", label: "En paz" },
] as const;
export type Emotion = (typeof emotions)[number]["value"];

export function parseMood(value: unknown): Mood | "" {
  return moods.find((mood) => mood.value === value)?.value ?? "";
}

export function newEntryForMood(mood: Mood) {
  return `/journal/new?mood=${mood}`;
}
export const intensities = [
  "Muy baja",
  "Baja",
  "Moderada",
  "Alta",
  "Muy alta",
] as const;
export const reasonGroups = [
  {
    value: "work",
    label: "Trabajo y responsabilidades",
    reasons: [
      { value: "workload", label: "Carga de trabajo" },
      { value: "deadlines", label: "Plazos y objetivos" },
      { value: "achievement", label: "Logros y resultados" },
      { value: "changes", label: "Cambios laborales" },
    ],
  },
  {
    value: "work-relationships",
    label: "Relaciones laborales",
    reasons: [
      { value: "teamwork", label: "Colaboración con el equipo" },
      { value: "conflict", label: "Conflictos" },
      { value: "recognition", label: "Reconocimiento" },
      { value: "leadership", label: "Relación con responsables" },
    ],
  },
  {
    value: "career",
    label: "Desarrollo profesional",
    reasons: [
      { value: "learning", label: "Aprendizaje" },
      { value: "growth", label: "Oportunidades de crecimiento" },
      { value: "uncertainty", label: "Incertidumbre profesional" },
    ],
  },
  {
    value: "balance",
    label: "Conciliación y organización",
    reasons: [
      { value: "schedule", label: "Horarios" },
      { value: "disconnecting", label: "Desconexión del trabajo" },
      { value: "planning", label: "Organización del tiempo" },
    ],
  },
  {
    value: "relationships",
    label: "Familia y relaciones personales",
    reasons: [
      { value: "family", label: "Familia" },
      { value: "friends", label: "Amistades" },
      { value: "partner", label: "Pareja" },
    ],
  },
  {
    value: "health",
    label: "Salud y bienestar",
    reasons: [
      { value: "sleep", label: "Descanso" },
      { value: "physical-health", label: "Salud física" },
      { value: "mental-health", label: "Bienestar emocional" },
      { value: "exercise", label: "Actividad física" },
    ],
  },
  {
    value: "personal",
    label: "Vida personal",
    reasons: [
      { value: "leisure", label: "Tiempo libre" },
      { value: "finances", label: "Finanzas" },
      { value: "life-events", label: "Acontecimientos personales" },
    ],
  },
  {
    value: "other",
    label: "Otros",
    reasons: [{ value: "unspecified", label: "Otro motivo" }],
  },
] as const;
export type Category = (typeof reasonGroups)[number]["value"];
export function categoryLabel(value: string | null) {
  return reasonGroups.find((g) => g.value === value)?.label ?? "Sin categoría";
}
export function reasonLabel(value: string | null) {
  return (
    reasonGroups.flatMap((g) => [...g.reasons]).find((r) => r.value === value)
      ?.label ?? "Sin motivo"
  );
}
