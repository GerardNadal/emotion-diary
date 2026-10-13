import assert from "node:assert/strict";
import { createOpenAIProvider } from "../src/modules/ai/openai-provider";
import { wellbeingQuotes } from "../src/modules/ai/quotes";

// A single explicit integration run. Synthetic context only, never an employee diary.
if (!process.env.OPENAI_API_KEY) {
  console.log("SKIP: OPENAI_API_KEY no está configurada; no se realiza ninguna solicitud.");
} else {
  try {
    const provider = createOpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL,
      metric: metric => console.log(JSON.stringify(metric)),
    });
    for (const context of [
      { mood: "Mal", emotion: "Ansioso", intensity: 3, category: "Trabajo y responsabilidades", reason: "Carga de trabajo" },
      { mood: "Muy mal", emotion: "Enfadado", intensity: 5, category: "Otros", reason: "Otro motivo" },
    ]) {
      const result = await provider.generate(context);
      assert.equal(result.data.music.length, 3);
      assert.ok(result.data.reflection && result.data.advice && result.data.activity.id);
      assert.ok(wellbeingQuotes[result.data.quoteId].text && wellbeingQuotes[result.data.quoteId].author);
      assert.doesNotMatch(`${result.data.reflection} ${result.data.accompaniment}`, /diario|herramienta|aplicaci[oó]n|este espacio|te acoge|te acompa[ñn]o|estoy aqu[ií]|sin juzgar|estar presente|otro motivo|no has detallado|faltan detalles/i);
    }
    console.log("PASS: SDK oficial, Responses API y salida estructurada real con contexto sintético; no se imprime contenido emocional.");
  } catch {
    console.error("FAIL: no se ha podido completar la prueba real de OpenAI; revisar credenciales, cuota o disponibilidad sin registrar el contenido.");
    process.exitCode = 1;
  }
}
