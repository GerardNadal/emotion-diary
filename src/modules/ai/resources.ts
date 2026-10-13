import type { ActivityId, EmotionalContext, Recommendation } from "./contracts";
import { localQuoteId } from "./quotes";

export const wellbeingActivities: Record<ActivityId, { title: string; duration: string; steps: string[] }> = {
  pause: { title: "Una pausa a tu ritmo", duration: "2 minutos", steps: ["Deja la tarea por un momento y busca una postura cómoda.", "Respira a tu ritmo, sin retener el aire ni forzar la respiración.", "Observa cómo estás. Puedes terminar la pausa cuando quieras."] },
  screen: { title: "Un descanso de pantalla", duration: "2 minutos", steps: ["Aparta la mirada de la pantalla.", "Mira hacia un punto lejano o cierra los ojos si te resulta cómodo.", "Vuelve cuando lo necesites."] },
  planning: { title: "Solo el siguiente paso", duration: "3 minutos", steps: ["Anota las tareas que ocupan tu atención.", "Elige un paso pequeño que puedas abordar hoy.", "Si la carga es excesiva, piensa qué prioridad puedes aclarar con tu responsable."] },
  movement: { title: "Muévete con suavidad", duration: "3 minutos", steps: ["Si te resulta cómodo, cambia de postura o camina un poco.", "Mueve suavemente hombros y manos, dentro de tus posibilidades.", "Detente si notas molestias; descansar también es una opción."] },
  reflection: { title: "Escucha lo que necesitas", duration: "3 minutos", steps: ["Pregúntate qué está ocupando tu atención.", "Pon nombre a una necesidad, sin juzgar tu emoción.", "Elige una acción pequeña o permite que este momento sea solo una pausa."] },
  communication: { title: "Prepara una conversación", duration: "4 minutos", steps: ["Describe una situación concreta, sin atribuir intenciones.", "Piensa cómo te afecta y qué necesitas.", "Si te sientes seguro, elige cuándo hablarlo y formula una petición concreta."] },
  disconnect: { title: "Cierra tu jornada", duration: "3 minutos", steps: ["Anota dónde has dejado la tarea para retomarla.", "Decide qué puede esperar hasta tu próxima jornada.", "Si tu horario lo permite, silencia las notificaciones laborales."] },
};

function localSupport(emotion: string) {
  switch (emotion.toLocaleLowerCase("es")) {
    case "enfadado": return {
      reflection: "Con enfado, puede costar tomar distancia antes de responder.",
      accompaniment: "No hace falta resolverlo todo en caliente; puedes darte unos minutos.",
    };
    case "ansioso": return {
      reflection: "La inquietud puede hacer que varias cosas parezcan urgentes a la vez.",
      accompaniment: "Quizá ayude elegir qué necesita tu atención ahora y qué puede esperar.",
    };
    case "triste": return {
      reflection: "Un día triste puede pesar más de lo que se ve desde fuera.",
      accompaniment: "Hoy puedes bajar un poco el ritmo, si te hace falta.",
    };
    case "feliz":
    case "emocionado":
    case "amado":
    case "celebrando": return {
      reflection: "Qué bien poder detenerte un momento en lo que te hace sentir así.",
      accompaniment: "Puedes disfrutarlo sin pasar enseguida a lo siguiente.",
    };
    case "tranquilo":
    case "en paz": return {
      reflection: "Estar en calma también merece un momento de atención.",
      accompaniment: "Fíjate en qué te ha sentado bien hoy; puede servirte en otro momento.",
    };
    default: return {
      reflection: "Puedes ir poco a poco con lo que sientes hoy.",
      accompaniment: "Por ahora puede bastar con pensar qué te vendría bien en este momento.",
    };
  }
}

export function localRecommendation(context: EmotionalContext): Recommendation {
  const work = /Trabajo|laborales|profesional|organización/.test(context.category);
  const id: ActivityId = context.reason === "Desconexión del trabajo" ? "disconnect" : work ? "planning" : "pause";
  const support = localSupport(context.emotion);
  return {
    crisis: false,
    reflection: support.reflection,
    advice: work ? "Elige una tarea pequeña y comprueba si necesitas aclarar prioridades o pedir apoyo." : "Dedica un momento a identificar qué necesitas ahora: descanso, compañía o espacio para ti.",
    activity: { id, reason: "Una opción breve que puedes adaptar a tus posibilidades." },
    accompaniment: support.accompaniment,
    quoteId: localQuoteId(context),
    music: [
      { title: "Clair de lune", artist: "Claude Debussy", reason: "Una propuesta instrumental para una pausa tranquila." },
      { title: "Here Comes the Sun", artist: "The Beatles", reason: "Puede acompañar un momento de movimiento suave, si te apetece." },
      { title: "Todo se transforma", artist: "Jorge Drexler", reason: "Una invitación musical a observar el cambio sin prisas." },
    ],
  };
}

export function crisisRecommendation(): Recommendation {
  return {
    ...localRecommendation({ mood: "", emotion: "", intensity: 1, category: "", reason: "" }),
    crisis: true,
    reflection: "Si estás atravesando un momento en el que podrías hacerte daño, mereces apoyo cercano ahora.",
    advice: "Si hay peligro inmediato, llama a emergencias de tu país o acude a urgencias. Contacta con una persona de confianza y, si puedes, permanece acompañado en un lugar seguro.",
    activity: { id: "pause", reason: "Prioriza contactar con ayuda humana. No necesitas completar ninguna actividad aquí." },
    accompaniment: "Este espacio no puede atender una emergencia. Puedes pedir ayuda aunque no sepas cómo explicar lo que te ocurre.",
  };
}
