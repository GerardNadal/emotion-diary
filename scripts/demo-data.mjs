import { createHash } from "node:crypto";

export const demoTeams = [
  { key: "desarrollo", name: "Demo · Desarrollo" },
  { key: "operaciones", name: "Demo · Operaciones" },
  { key: "producto", name: "Demo · Producto" },
  { key: "soporte", name: "Demo · Soporte" },
  { key: "marketing", name: "Demo · Marketing" },
  { key: "personas", name: "Demo · Personas" },
];
export const demoManagers = [
  { email: "responsable@example.test", full_name: "Mario Demo", teams: ["desarrollo", "producto"] },
  { email: "responsable.operaciones@example.test", full_name: "Ana Demo", teams: ["operaciones", "soporte"] },
  { email: "responsable.marketing@example.test", full_name: "Sergio Demo", teams: ["marketing"] },
  { email: "responsable.personas@example.test", full_name: "Carmen Demo", teams: ["personas"] },
];
const names = ["Lucía", "David", "Alba", "Pablo", "Nora", "Hugo", "Sara", "Diego", "Inés", "Leo", "Clara", "Adrián", "Julia", "Marcos", "Eva", "Daniel", "Marta", "Iván", "Paula", "Álex"];
const surnames = ["García", "Martín", "López", "Sánchez", "Romero", "Torres"];

export function demoProfiles() {
  return [
    { email: "empresa@example.test", full_name: "Elena Demo", role: "company_admin", team: null, active: true },
    ...demoManagers.map(({ email, full_name }) => ({ email, full_name, role: "team_admin", team: null, active: true })),
    ...demoTeams.flatMap(({ key }, teamIndex) => Array.from({ length: 10 }, (_, index) => {
      const legacy = index === 0 && teamIndex < 2;
      return {
        email: legacy ? `${key}@example.test` : `demo.${key}.${String(index + 1).padStart(2, "0")}@example.test`,
        full_name: legacy ? (teamIndex === 0 ? "Lucía Demo" : "David Demo") : `${names[(teamIndex * 7 + index) % names.length]} ${surnames[teamIndex]} Demo`,
        role: "employee", team: key, active: index !== 9,
      };
    })),
  ];
}

// All catalog pairs, with workplace factors appearing more often than personal ones.
const situations = [
  ["work", "workload", "Una jornada con varias tareas en paralelo."],
  ["work", "deadlines", "La entrega del proyecto está cerca."],
  ["work", "achievement", "He completado un objetivo que me había propuesto."],
  ["work", "changes", "Hoy hemos ajustado la forma de trabajar."],
  ["work-relationships", "teamwork", "Hemos resuelto una tarea entre varias personas."],
  ["work-relationships", "conflict", "Ha habido diferencias de criterio en una reunión."],
  ["work-relationships", "recognition", "He recibido comentarios sobre mi trabajo."],
  ["work-relationships", "leadership", "He hablado con mi responsable sobre las prioridades."],
  ["career", "learning", "He dedicado tiempo a aprender algo nuevo."],
  ["career", "growth", "Estoy pensando en mis siguientes pasos profesionales."],
  ["career", "uncertainty", "Todavía no tengo claras algunas decisiones del proyecto."],
  ["balance", "schedule", "Hoy he reorganizado mis horarios."],
  ["balance", "disconnecting", "He reservado un rato para desconectar del trabajo."],
  ["balance", "planning", "He revisado mi agenda para la semana."],
  ["relationships", "family", "He compartido tiempo con mi familia."],
  ["relationships", "friends", "He quedado con amistades después del día."],
  ["relationships", "partner", "He tenido una conversación personal importante."],
  ["health", "sleep", "He prestado atención a cómo estoy descansando."],
  ["health", "physical-health", "Hoy he escuchado las necesidades de mi cuerpo."],
  ["health", "mental-health", "He hecho una pausa para observar cómo me siento."],
  ["health", "exercise", "He salido a caminar y moverme un poco."],
  ["personal", "leisure", "He dedicado tiempo a una afición."],
  ["personal", "finances", "He revisado algunos gastos personales."],
  ["personal", "life-events", "Estoy adaptándome a un cambio personal."],
  ["other", "unspecified", "Hoy me ha influido una situación diferente."],
];
const moods = ["very-low", "low", "neutral", "good", "very-good"];
const emotionsByMood = [["sadness", "anxiety", "anger"], ["anxiety", "sadness"], ["calm", "peace"], ["joy", "calm", "excitement"], ["celebration", "loved", "peace", "joy"]];
const reactions = ["He hecho una pausa antes de continuar.", "He anotado lo que necesitaba para ordenar mis ideas.", "He hablado con alguien de confianza.", "He dividido la tarea en pasos pequeños."];
const support = ["Disponer de un rato tranquilo.", "Aclarar las prioridades de la semana.", "Pedir ayuda cuando la necesite.", "Mantener tiempo para descansar."];
function hash(value) { return createHash("sha256").update(value).digest(); }
function entryId(key) {
  const bytes = hash(`emotion-diary-demo-v1:${key}`).subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const value = bytes.toString("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
export function demoEndDate(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}
export function demoEntries(profile, { days = 180, endDate = demoEndDate() } = {}) {
  if (!Number.isInteger(days) || days < 7 || days > 365) throw new Error("DEMO_DAYS debe ser un entero entre 7 y 365.");
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(end) || new Date(end).toISOString().slice(0, 10) !== endDate) throw new Error("Fecha de demo inválida.");
  if (!profile.active) return [];
  const entries = [];
  const teamIndex = Math.max(0, demoTeams.findIndex((team) => team.key === profile.team));
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(end - offset * 86_400_000);
    const day = date.toISOString().slice(0, 10);
    const daily = hash(`${profile.email}:${day}`);
    if (daily[0] % 10 < 2 + teamIndex % 3) continue;
    for (let slot = 0; slot < (daily[1] % 7 === 0 ? 2 : 1); slot++) {
      const values = hash(`${profile.email}:${day}:${slot}`);
      const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
      const situationIndex = weekend ? 14 + values[2] % 11 : values[2] % 35 % situations.length;
      const [category, reason, context] = situations[situationIndex];
      const score = values[3] % 100 + [-4, -16, 8, -10, 4, 14][teamIndex] + (date.getUTCMonth() % 3 - 1) * 6;
      const moodIndex = score < 10 ? 0 : score < 28 ? 1 : score < 46 ? 2 : score < 82 ? 3 : 4;
      const possibleEmotions = emotionsByMood[moodIndex];
      const withoutReason = values[4] % 13 === 0;
      const customReason = !withoutReason && values[4] % 11 === 0;
      entries.push({
        id: entryId(`${profile.email}:${day}:${slot}`),
        entry: {
          mood: moods[moodIndex], emotion: possibleEmotions[values[5] % possibleEmotions.length], intensity: 1 + values[6] % 5,
          reflection: values[7] % 4 === 0 ? "" : `Registro ficticio de demostración. ${context} Quiero prestar atención a cómo evoluciona mi día.`,
          category: withoutReason ? null : category, reason: withoutReason || customReason ? null : reason,
          custom_reason: customReason ? "Situación de demostración que quería registrar con mis propias palabras." : "",
          activity: values[8] % 3 === 0 ? "" : (weekend ? "Tiempo personal y descanso" : "Revisión de tareas y reunión de equipo"),
          reaction: values[9] % 3 === 0 ? "" : reactions[values[9] % reactions.length],
          support: values[10] % 3 === 0 ? "" : support[values[10] % support.length],
          occurred_at: `${day}T${slot === 0 ? "10" : "17"}:${String(values[11] % 60).padStart(2, "0")}:00.000Z`,
        },
      });
    }
  }
  return entries;
}
