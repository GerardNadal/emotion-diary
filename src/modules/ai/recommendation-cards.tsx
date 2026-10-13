import { Leaf, Sparkles, Music2 } from "lucide-react";
import { ActivityCard } from "./activity-card";
import type { RecommendationResult } from "./contracts";
import { wellbeingQuotes } from "./quotes";

export function RecommendationMusic({ result }: { result: Extract<RecommendationResult, { ok: true }> }) {
  return <>
    <p>Sugerencias {result.source === "openai" ? "de GPT" : "del catálogo local"} sin verificar. La búsqueda envía solo el título y el artista.</p>
    <ul className="recommendation-songs">
      {result.data.music.map((song, index) => <li key={index}>
        <h3>{song.title} · {song.artist}</h3>
        <p>{song.reason}</p>
        <a target="_blank" rel="noopener noreferrer" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.title} ${song.artist}`)}`}>
          Escuchar en YouTube
        </a>
      </li>)}
    </ul>
  </>;
}

export function RecommendationCards({ result }: { result: RecommendationResult | null }) {
  const response = result?.ok ? result : null;
  const recommendation = response?.data;
  const quote = wellbeingQuotes[recommendation?.quoteId ?? "self"];
  return <div className="resources recommendation-cards">
    <section className="resource-panel mint">
      <div className="resource-title"><Leaf aria-hidden="true" /><h2>Vuelve a este momento</h2></div>
      {recommendation ? <>
        <p>{recommendation.reflection}</p>
        <p>{recommendation.accompaniment}</p>
      </> : <ActivityCard id="pause" />}
    </section>
    <section className="resource-panel lavender">
      <div className="resource-title"><Sparkles aria-hidden="true" /><h2>{recommendation?.crisis ? "Busca apoyo ahora" : "Frase para ti"}</h2></div>
      {recommendation?.crisis ? <p>{recommendation.advice}</p> : <figure className="wellbeing-quote">
        <blockquote cite={quote.source}>«{quote.text}»</blockquote>
        <figcaption>
          <a href={quote.source} target="_blank" rel="noopener noreferrer" title={quote.work}>{quote.author}</a>
          {quote.translated ? <span> · Traducción</span> : null}
        </figcaption>
      </figure>}
    </section>
    {!recommendation?.crisis ? <section className="resource-panel peach">
      <div className="resource-title"><Music2 aria-hidden="true" /><h2>Encuentra tu sintonía</h2></div>
      {response ? <RecommendationMusic result={response} /> : <ActivityCard id="disconnect" />}
    </section> : null}
  </div>;
}
