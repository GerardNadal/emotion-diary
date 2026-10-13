"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateRecommendation } from "./actions";
import { RecommendationCards, RecommendationMusic } from "./recommendation-cards";
import type { RecommendationResult } from "./contracts";

export function RecommendationPanel({ entryId, entries, onEntryChange, layout = "inline" }: {
  entryId?: string;
  entries?: { id: string; label: string }[];
  onEntryChange?: (entryId: string) => void;
  layout?: "inline" | "cards";
}) {
  const [shareText, setShareText] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const busy = useRef(false);
  async function generate() {
    if (busy.current || !entryId) return;
    busy.current = true; setPending(true); setResult(null);
    try { setResult(await generateRecommendation({ entryId, shareText })); }
    catch { setResult({ ok: false, message: "No se ha podido conectar. Puedes reintentar; las actividades generales siguen disponibles en Para ti." }); }
    finally { busy.current = false; setPending(false); }
  }
  const recommendation = result?.ok ? result.data : null;
  return <>
    <section className="resource-panel lavender ai-panel" aria-labelledby={`ai-title-${entryId ?? "empty"}`} aria-busy={pending}>
    <div className="resource-title"><Sparkles aria-hidden="true" /><h2 id={`ai-title-${entryId ?? "empty"}`}>Recomendación</h2></div>
    {entries ? <div className="ai-entry-selector">
      {entries.length ? <>
        <label htmlFor="recommendation-entry">Entrada para la recomendación</label>
        <select id="recommendation-entry" value={entryId} disabled={pending} onChange={event => onEntryChange?.(event.target.value)}>
          {entries.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
        <Link href="/journal/history">Ver diario</Link>
      </> : <>
        <p>Sin entradas disponibles.</p>
        <Link href="/journal/new">Registrar un momento</Link>
      </>}
    </div> : null}
    {entryId ? <>
    <p>Al solicitarla, se envían a OpenAI el ánimo, emoción, intensidad, categoría y motivo de esta entrada. Se excluyen el historial y los datos de cuenta.</p>
    <label className="ai-consent">
      <input type="checkbox" checked={shareText} disabled={pending} onChange={event => { setShareText(event.target.checked); setResult(null); }} />
      <span>Quiero incluir mi reflexión, motivo personalizado, actividad preferida y reacción. He revisado que no contienen nombres ni datos que identifiquen a personas o a la empresa.</span>
    </label>
    <details>
      <summary>Datos enviados y límites de uso</summary>
      <p>El texto libre se excluye por defecto. Si lo compartes, se limita y se eliminan identificadores evidentes; esa eliminación no garantiza anonimato. Las respuestas no se guardan permanentemente en Dentro. OpenAI puede conservar datos para controlar abusos hasta 30 días según la configuración de la organización.</p>
      <p>Límite: una solicitud por minuto, tres por hora y diez en 24 horas. Las respuestas recientes se reutilizan durante 15 minutos.</p>
      <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noopener noreferrer">Tratamiento de datos de la API de OpenAI</a>
    </details>
    <div className="form-actions"><Button disabled={pending} onClick={generate}>{pending ? "Preparando tu sugerencia…" : result && (!result.ok || result.source === "local") ? "Reintentar con OpenAI" : "Solicitar recomendación"}</Button></div>
    {pending ? <p role="status">Generando recomendación…</p> : null}
    {result ? <p role={result.ok ? "status" : "alert"}>{result.ok ? `${result.notice}${result.cached ? " Reutilizamos tu respuesta reciente sin otra solicitud a OpenAI." : ""}` : result.message}</p> : null}
    </> : null}
    {layout === "inline" && recommendation && result?.ok ? <div className="ai-result">
      <div><h3>Tu momento</h3><p>{recommendation.reflection}</p></div>
      <div><h3>{recommendation.crisis ? "Busca apoyo ahora" : "Un paso posible"}</h3><p>{recommendation.advice}</p></div>
      <p>{recommendation.accompaniment}</p>
      {!recommendation.crisis ? <details className="music-suggestions"><summary><Music2 aria-hidden="true" /> Música para acompañarte</summary>
        <RecommendationMusic result={result} />
      </details> : null}
    </div> : null}
    </section>
    {layout === "cards" ? <RecommendationCards result={result} /> : null}
  </>;
}
