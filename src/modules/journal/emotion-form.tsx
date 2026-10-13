"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Info, Check, ChevronDown } from "lucide-react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmotionPicker } from "./emotion-picker";
import { MoodPicker } from "./mood-picker";
import {
  moods,
  emotions,
  reasonGroups,
  type Mood,
  type Emotion,
} from "./emotions";

export function EmotionForm({ initialMood = "" }: { initialMood?: Mood | "" }) {
  const [mood, setMood] = useState<Mood | "">(initialMood);
  const [emotion, setEmotion] = useState<Emotion | "">("");
  const [intensity, setIntensity] = useState(3);
  const [reasons, setReasons] = useState<string[]>([]);
  const [reflection, setReflection] = useState("");
  const [activity, setActivity] = useState("");
  const [reaction, setReaction] = useState("");
  const [support, setSupport] = useState("");
  const [invalidMood, setInvalidMood] = useState(false);
  const [invalidEmotion, setInvalidEmotion] = useState(false);
  const [review, setReview] = useState(false);
  const moodPicker = useRef<HTMLFieldSetElement>(null);
  const emotionPicker = useRef<HTMLFieldSetElement>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!mood || !emotion) {
      setInvalidMood(!mood);
      setInvalidEmotion(!emotion);
      const missing = !mood ? moodPicker : emotionPicker;
      missing.current?.querySelector<HTMLButtonElement>("button")?.focus();
      return;
    }
    setReview(true);
  }
  const selected = emotions.find((item) => item.value === emotion);
  const selectedMood = moods.find((item) => item.value === mood);
  return (
    <div className="journal-form-wrap">
      <Alert className="preview-notice">
        <Info />
        <AlertDescription>
          Vista previa · Las entradas todavía no se guardan. Al salir, se
          descarta lo que escribas.
        </AlertDescription>
      </Alert>
      {review ? (
        <section className="review-panel" aria-labelledby="review-title">
          <div className="review-heading">
            <span
              className="emotion-face"
              data-emotion={selectedMood?.color}
              aria-hidden="true"
            >
              {selectedMood?.emoji}
            </span>
            <div>
              <h2 id="review-title">Así has descrito tu día</h2>
              <p>
                {selectedMood?.label} · {selected?.label} · Intensidad{" "}
                {intensity} de 5
              </p>
            </div>
          </div>
          <dl className="review-details">
            <div>
              <dt>Estado de ánimo</dt>
              <dd>{selectedMood?.label}</dd>
            </div>
            <div>
              <dt>Emoción específica</dt>
              <dd>{selected?.label}</dd>
            </div>
            <div>
              <dt>Motivos</dt>
              <dd>
                {reasons.length
                  ? reasons.join(", ")
                  : "Sin motivos seleccionados"}
              </dd>
            </div>
            {[
              { label: "Reflexión", value: reflection },
              { label: "Actividad preferida", value: activity },
              { label: "Tu reacción", value: reaction },
              { label: "Apoyo recibido", value: support },
            ]
              .filter((item) => item.value.trim())
              .map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
          </dl>
          <Alert>
            <Check />
            <AlertDescription>
              Has probado el registro. Esta entrada no se ha guardado.
            </AlertDescription>
          </Alert>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setReview(false)}>
              <ArrowLeft data-icon="inline-start" />
              Volver a editar
            </Button>
            <Link href="/journal" className={buttonVariants()}>
              Terminar vista previa
            </Link>
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
                onChange={(value) => {
                  setMood(value);
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
                onChange={(value) => {
                  setEmotion(value);
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
                <span className="intensity-value">{intensity} de 5</span>
              </FieldLabel>
              <input
                id="intensity"
                type="range"
                min="1"
                max="5"
                step="1"
                value={intensity}
                onChange={(event) => setIntensity(Number(event.target.value))}
                aria-valuetext={`${intensity} de 5`}
              />
              <div className="range-labels">
                <span>Suave</span>
                <span>Muy intensa</span>
              </div>
            </Field>
            <FieldSet>
              <FieldLegend>
                ¿Qué lo ha provocado?{" "}
                <span className="optional">(opcional)</span>
              </FieldLegend>
              <div className="reason-columns">
                {reasonGroups.map((group) => (
                  <FieldSet key={group.label}>
                    <FieldLegend variant="label">{group.label}</FieldLegend>
                    <ToggleGroup
                      multiple
                      className="reason-picker"
                      value={reasons.filter((reason) =>
                        (group.reasons as readonly string[]).includes(reason),
                      )}
                      onValueChange={(values) =>
                        setReasons((current) => [
                          ...current.filter(
                            (reason) =>
                              !(group.reasons as readonly string[]).includes(
                                reason,
                              ),
                          ),
                          ...values,
                        ])
                      }
                      aria-label={group.label}
                    >
                      {group.reasons.map((reason) => (
                        <ToggleGroupItem
                          variant="outline"
                          key={reason}
                          value={reason}
                        >
                          {reason}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </FieldSet>
                ))}
              </div>
            </FieldSet>
            <Field>
              <FieldLabel htmlFor="reflection">
                ¿Quieres contar un poco más?{" "}
                <span className="optional">(opcional)</span>
              </FieldLabel>
              <Textarea
                id="reflection"
                placeholder="Escribe aquí lo que quieras…"
                rows={3}
                maxLength={2000}
                value={reflection}
                onChange={(event) => setReflection(event.target.value)}
              />
              <FieldDescription>
                No necesitas encontrar las palabras perfectas.
              </FieldDescription>
            </Field>
            <details className="extra-details">
              <summary>
                <div>
                  <strong>Un poco más sobre tu día</strong>
                  <span>Actividad, reacción y apoyo recibido · opcional</span>
                </div>
                <ChevronDown aria-hidden="true" />
              </summary>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="activity">
                    ¿Qué te habría gustado hacer?
                  </FieldLabel>
                  <Input
                    id="activity"
                    maxLength={250}
                    value={activity}
                    onChange={(event) => setActivity(event.target.value)}
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
                    onChange={(event) => setReaction(event.target.value)}
                    placeholder="¿Qué hiciste al sentirte así?"
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
                    onChange={(event) => setSupport(event.target.value)}
                    placeholder="Puedes contar qué te ayudó, sin identificar a otras personas."
                  />
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
