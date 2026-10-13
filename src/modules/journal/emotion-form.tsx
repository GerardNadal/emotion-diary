"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
  LoaderCircle,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { EmotionPicker } from "./emotion-picker";
import { MoodPicker } from "./mood-picker";
import {
  moods,
  emotions,
  reasonGroups,
  intensities,
  categoryLabel,
  reasonLabel,
  type Mood,
  type Emotion,
  type Category,
} from "./emotions";
import { journalInputSchema } from "./validation";
import { saveEntry } from "./actions";
import { browserTimezone, localDateTime } from "./dates";
import type { JournalEntry, JournalInput } from "./types";

export function EmotionForm({
  initialMood = "",
  entry,
}: {
  initialMood?: Mood | "";
  entry?: JournalEntry;
}) {
  const [mood, setMood] = useState<Mood | "">(entry?.mood ?? initialMood);
  const [emotion, setEmotion] = useState<Emotion | "">(entry?.emotion ?? "");
  const [intensity, setIntensity] = useState(entry?.intensity ?? 3);
  const [category, setCategory] = useState<Category | "">(
    entry?.category ?? "",
  );
  const [reason, setReason] = useState(entry?.reason ?? "");
  const [customReason, setCustomReason] = useState(entry?.custom_reason ?? "");
  const [reflection, setReflection] = useState(entry?.reflection ?? "");
  const [activity, setActivity] = useState(entry?.activity ?? "");
  const [reaction, setReaction] = useState(entry?.reaction ?? "");
  const [support, setSupport] = useState(entry?.support ?? "");
  const [occurredAt, setOccurredAt] = useState("");
  const [dateChanged, setDateChanged] = useState(false);
  const [invalidMood, setInvalidMood] = useState(false);
  const [invalidEmotion, setInvalidEmotion] = useState(false);
  const [review, setReview] = useState<JournalInput | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<JournalEntry | null>(null);
  const id = useRef(entry?.id ?? "");
  const busy = useRef(false);
  const moodPicker = useRef<HTMLFieldSetElement>(null);
  const emotionPicker = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (entry)
      queueMicrotask(() => setOccurredAt(localDateTime(entry.occurred_at)));
  }, [entry]);
  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!mood || !emotion) {
      setInvalidMood(!mood);
      setInvalidEmotion(!emotion);
      (!mood ? moodPicker : emotionPicker).current
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus();
      return;
    }
    const date =
      entry && !dateChanged
        ? new Date(entry.occurred_at)
        : occurredAt
          ? new Date(occurredAt)
          : entry
            ? new Date(entry.occurred_at)
            : new Date();
    if (!Number.isFinite(date.getTime())) {
      setError("Introduce una fecha y hora válidas.");
      return;
    }
    const parsed = journalInputSchema.safeParse({
      mood,
      emotion,
      intensity,
      category: category || null,
      reason: reason || null,
      custom_reason: customReason,
      reflection,
      activity,
      reaction,
      support,
      occurred_at: date.toISOString(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (!id.current) id.current = crypto.randomUUID();
    setReview(parsed.data);
  }
  async function save() {
    if (!review || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await saveEntry(id.current, review, !entry, browserTimezone());
      if (result.ok) setSaved(result.data);
      else setError(result.message);
    } catch {
      setError(
        "No se ha podido guardar. Conservamos el contenido para que puedas reintentarlo.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const selected = emotions.find((e) => e.value === emotion);
  const selectedMood = moods.find((m) => m.value === mood);
  const group = reasonGroups.find((g) => g.value === category);
  if (saved)
    return (
      <section className="review-panel" aria-labelledby="saved-title">
        <h2 id="saved-title">
          {entry ? "Entrada actualizada" : "Entrada guardada"}
        </h2>
        <Alert>
          <Check />
          <AlertDescription>
            Tu registro se ha guardado en tu diario privado.
          </AlertDescription>
        </Alert>
        <div className="form-actions">
          <Link
            href={`/journal/${saved.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Ver mi entrada
          </Link>
          <Link href="/journal/history" className={buttonVariants()}>
            Volver al diario
          </Link>
        </div>
      </section>
    );
  return (
    <div className="journal-form-wrap">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {review ? (
        <section
          className="review-panel"
          aria-labelledby="review-title"
          aria-busy={pending}
        >
          <div className="review-heading">
            <span
              className="emotion-face"
              data-emotion={selectedMood?.color}
              aria-hidden="true"
            >
              {selectedMood?.emoji}
            </span>
            <div>
              <h2 id="review-title">Así has descrito este momento</h2>
              <p>
                {selectedMood?.label} · {selected?.label} ·{" "}
                {intensities[intensity - 1]}
              </p>
            </div>
          </div>
          <dl className="review-details">
            <div>
              <dt>Fecha y hora</dt>
              <dd>{new Date(review.occurred_at).toLocaleString("es")}</dd>
            </div>
            <div>
              <dt>Motivo</dt>
              <dd>
                {categoryLabel(review.category)} · {reasonLabel(review.reason)}
                {review.custom_reason ? ` · ${review.custom_reason}` : ""}
              </dd>
            </div>
            {[
              { label: "Reflexión", value: reflection },
              { label: "Actividad que te ayuda", value: activity },
              { label: "Tu reacción", value: reaction },
              { label: "Apoyo recibido", value: support },
            ]
              .filter((i) => i.value.trim())
              .map((i) => (
                <div key={i.label}>
                  <dt>{i.label}</dt>
                  <dd>{i.value}</dd>
                </div>
              ))}
          </dl>
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setReview(null)}
            >
              <ArrowLeft data-icon="inline-start" />
              Volver a editar
            </Button>
            <Button disabled={pending} onClick={save}>
              {pending ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <Check data-icon="inline-start" />
              )}
              {pending ? "Guardando…" : "Guardar entrada"}
            </Button>
          </div>
        </section>
      ) : (
        <form onSubmit={submit}>
          <FieldGroup>
            <FieldSet className="form-emotions" ref={moodPicker}>
              <FieldLegend>Estado de ánimo</FieldLegend>
              <MoodPicker
                value={mood}
                invalid={invalidMood}
                onChange={(v) => {
                  setMood(v);
                  setInvalidMood(false);
                }}
              />
              {invalidMood ? (
                <p id="mood-error" className="field-error" role="alert">
                  Elige un estado de ánimo para continuar.
                </p>
              ) : null}
            </FieldSet>
            <FieldSet ref={emotionPicker}>
              <FieldLegend>Emoción específica</FieldLegend>
              <EmotionPicker
                value={emotion}
                invalid={invalidEmotion}
                onChange={(v) => {
                  setEmotion(v);
                  setInvalidEmotion(false);
                }}
              />
              {invalidEmotion ? (
                <p id="emotion-error" className="field-error" role="alert">
                  Elige una emoción para continuar.
                </p>
              ) : null}
            </FieldSet>
            <Field>
              <FieldLabel htmlFor="intensity">
                ¿Con qué intensidad?{" "}
                <span className="intensity-value">
                  {intensities[intensity - 1]}
                </span>
              </FieldLabel>
              <input
                id="intensity"
                type="range"
                min="1"
                max="5"
                step="1"
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                aria-valuetext={intensities[intensity - 1]}
              />
              <div className="range-labels">
                <span>Muy baja</span>
                <span>Muy alta</span>
              </div>
            </Field>
            <details className="extra-details">
              <summary>
                <div>
                  <strong>Un poco más sobre este momento</strong>
                  <span>Reflexión, motivos, actividad y apoyo · opcional</span>
                </div>
                <ChevronDown aria-hidden="true" />
              </summary>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="reflection">
                    ¿Quieres contar un poco más?
                  </FieldLabel>
                  <Textarea
                    id="reflection"
                    placeholder="Escribe aquí lo que quieras…"
                    rows={3}
                    maxLength={2000}
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                  />
                  <FieldDescription>
                    No necesitas encontrar las palabras perfectas.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="category">
                    Categoría del motivo
                  </FieldLabel>
                  <NativeSelect
                    id="category"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value as Category | "");
                      setReason("");
                    }}
                  >
                    <NativeSelectOption value="">
                      Sin categoría
                    </NativeSelectOption>
                    {reasonGroups.map((g) => (
                      <NativeSelectOption key={g.value} value={g.value}>
                        {g.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="reason">
                    Motivo desencadenante
                  </FieldLabel>
                  <NativeSelect
                    id="reason"
                    value={reason}
                    disabled={!category}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    <NativeSelectOption value="">
                      Sin motivo concreto
                    </NativeSelectOption>
                    {group?.reasons.map((r) => (
                      <NativeSelectOption key={r.value} value={r.value}>
                        {r.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="custom-reason">
                    Tu propio motivo
                  </FieldLabel>
                  <Input
                    id="custom-reason"
                    maxLength={250}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Puedes escribir otro motivo para esta categoría"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="activity">
                    ¿Qué te ayuda a sentirte mejor?
                  </FieldLabel>
                  <Input
                    id="activity"
                    maxLength={250}
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    placeholder="Dar un paseo, descansar…"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="reaction">
                    ¿Cómo reaccionaste?
                  </FieldLabel>
                  <Textarea
                    id="reaction"
                    maxLength={1000}
                    value={reaction}
                    onChange={(e) => setReaction(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="support">
                    ¿Recibiste apoyo emocional?
                  </FieldLabel>
                  <Textarea
                    id="support"
                    maxLength={1000}
                    value={support}
                    onChange={(e) => setSupport(e.target.value)}
                    placeholder="Puedes contar qué te ayudó, sin identificar a otras personas."
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="occurred-at">
                    Fecha y hora del momento
                  </FieldLabel>
                  <Input
                    id="occurred-at"
                    type="datetime-local"
                    min="1900-01-01T00:00"
                    max="2199-12-31T23:59"
                    value={occurredAt}
                    onChange={(e) => {
                      setOccurredAt(e.target.value);
                      setDateChanged(true);
                    }}
                  />
                  <FieldDescription>
                    {entry
                      ? "Se conserva la fecha original si dejas este campo vacío."
                      : "Si lo dejas vacío, usamos la hora actual."}{" "}
                    Hora de tu dispositivo.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </details>
            <div className="form-actions">
              <Link
                href="/journal/history"
                className={buttonVariants({ variant: "ghost" })}
              >
                Volver al diario
              </Link>
              <Button type="submit">
                Revisar mi entrada
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </FieldGroup>
        </form>
      )}
    </div>
  );
}
