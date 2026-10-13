"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeading } from "@/components/page-heading";
import {
  moods,
  emotions,
  intensities,
  categoryLabel,
  reasonLabel,
} from "./emotions";
import { displayDate } from "./dates";
import { deleteEntries } from "./actions";
import type { JournalEntry } from "./types";
import { RecommendationPanel } from "@/modules/ai/recommendation-panel";

export function EntryDetails({ entry }: { entry: JournalEntry }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  useEffect(() => {
    queueMicrotask(() => setReady(true));
  }, []);
  async function remove() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await deleteEntries([entry.id]);
      if (result.ok) router.replace("/journal/history");
      else setError(result.message);
    } catch {
      setError("No se ha podido eliminar. Puedes reintentarlo.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const mood = moods.find((m) => m.value === entry.mood);
  const emotion = emotions.find((e) => e.value === entry.emotion);
  const date = (value: string) => (ready ? displayDate(value) : "…");
  return (
    <>
      <PageHeading
        title="Un momento de tu diario"
        description={date(entry.occurred_at)}
      />
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <section className="review-panel">
        <div className="review-heading">
          <span
            className="emotion-face"
            data-emotion={mood?.color}
            aria-hidden="true"
          >
            {mood?.emoji}
          </span>
          <div>
            <h2>
              {mood?.label} · {emotion?.label}
            </h2>
            <p>Intensidad {intensities[entry.intensity - 1]}</p>
          </div>
        </div>
        <dl className="review-details">
          <div>
            <dt>Categoría</dt>
            <dd>{categoryLabel(entry.category)}</dd>
          </div>
          <div>
            <dt>Motivo</dt>
            <dd>{reasonLabel(entry.reason)}</dd>
          </div>
          {[
            { label: "Motivo personalizado", value: entry.custom_reason },
            { label: "Reflexión", value: entry.reflection },
            { label: "Actividad que te ayuda", value: entry.activity },
            { label: "Tu reacción", value: entry.reaction },
            { label: "Apoyo recibido", value: entry.support },
          ].map((i) => (
            <div key={i.label}>
              <dt>{i.label}</dt>
              <dd>{i.value || "Sin especificar"}</dd>
            </div>
          ))}
          <div>
            <dt>Creación</dt>
            <dd>{date(entry.created_at)}</dd>
          </div>
          <div>
            <dt>Última modificación</dt>
            <dd>{date(entry.updated_at)}</dd>
          </div>
        </dl>
        <div className="form-actions">
          <Link
            href="/journal/history"
            className={buttonVariants({ variant: "ghost" })}
          >
            Volver al diario
          </Link>
          <Link
            href={`/journal/${entry.id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            Editar entrada
          </Link>
          <Button variant="destructive" onClick={() => setConfirm(true)}>
            Eliminar entrada
          </Button>
        </div>
      </section>
      <RecommendationPanel key={entry.updated_at} entryId={entry.id} />
      {confirm ? (
        <Alert
          role="alertdialog"
          aria-labelledby="delete-title"
          aria-describedby="delete-description"
        >
          <AlertDescription>
            <strong id="delete-title">Eliminar esta entrada</strong>
            <p id="delete-description">Esta acción no se puede deshacer.</p>
            <div className="form-actions">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => setConfirm(false)}
              >
                Cancelar
              </Button>
              <Button variant="destructive" disabled={pending} onClick={remove}>
                {pending ? "Eliminando…" : "Confirmar eliminación"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
