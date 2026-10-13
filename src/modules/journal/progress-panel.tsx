"use client";
import { useEffect, useState } from "react";
import { Sprout, Flower2, Flame, Heart } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmotionalCalendar } from "./calendar";
import { personalProgress } from "./evolution-actions";
import type { Progress } from "./evolution-types";

const milestones = [
  {
    value: 1,
    title: "Un momento para ti",
    icon: Sprout,
    message: "Has hecho espacio para escucharte.",
  },
  {
    value: 5,
    title: "Tu propio ritmo",
    icon: Flame,
    message: "Cinco días encontrando un momento para ti.",
  },
  {
    value: 10,
    title: "Un hábito que florece",
    icon: Flower2,
    message: "Diez días cultivando tu espacio personal.",
  },
  {
    value: 30,
    title: "Un espacio que te acompaña",
    icon: Heart,
    message: "Treinta días de escucha. Tu recorrido es tuyo.",
  },
];
export function ProgressPanel({ initial }: { initial: Progress }) {
  const [month, setMonth] = useState(initial.month);
  const [progress, setProgress] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await personalProgress(initial.timezone, month);
        if (!current) return;
        if (response.ok) setProgress(response.data);
        else setError(response.message);
      } catch {
        if (current) setError("No se ha podido consultar tu actividad.");
      } finally {
        if (current) setLoading(false);
      }
    }
    if (month !== initial.month || revision) void load();
    else
      queueMicrotask(() => {
        if (current) {
          setProgress(initial);
          setLoading(false);
          setError("");
        }
      });
    return () => {
      current = false;
    };
  }, [initial, month, revision]);
  const latest = [...progress.rewards].sort(
    (a, b) => b.milestone - a.milestone,
  )[0];
  return (
    <div className="insight-grid">
      <div className="evolution-stack">
        <section className="surface">
          <h2>Tu constancia, a tu manera</h2>
          <div className="streak-metrics">
            <div>
              <strong>{progress.current}</strong>
              <span>días de racha actual</span>
            </div>
            <div>
              <strong>{progress.best}</strong>
              <span>récord personal</span>
            </div>
          </div>
          <p className="metric-note">
            {progress.active_days} días de actividad desde que se activaron las
            rachas. Crear una entrada o completar por primera vez su reflexión
            cuenta; entrar o navegar no cuenta. Hoy puedes continuar una racha
            que llegó hasta ayer.
          </p>
          <p className="metric-note">
            Las pausas no restan nada a tu camino. Las recompensas que has
            recibido se conservan.
          </p>
        </section>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
              <Button
                variant="outline"
                onClick={() => setRevision((v) => v + 1)}
              >
                Reintentar actividad
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        <EmotionalCalendar
          today={progress.today}
          month={month}
          days={[]}
          selectedDay={null}
          loading={loading}
          onMonth={setMonth}
          activityDays={
            loading || progress.month !== month || error ? [] : progress.days
          }
        />
      </div>
      <section className="surface">
        <h2>Pequeños pasos</h2>
        <p className="metric-note">
          Reconocimientos personales. Sin metas obligatorias ni comparaciones.
        </p>
        {latest ? (
          <p className="milestone-message" role="status">
            {milestones.find((m) => m.value === latest.milestone)?.message}
          </p>
        ) : null}
        <div className="reward-list">
          {milestones.map((m) => {
            const earned = progress.rewards.find(
              (r) => r.milestone === m.value,
            );
            const Icon = m.icon;
            return (
              <div key={m.value} className="reward-row" data-earned={!!earned}>
                <Icon aria-hidden="true" />
                <div>
                  <h3>{m.title}</h3>
                  <p>
                    {m.value === 1
                      ? "Primer día de actividad"
                      : `${m.value} días consecutivos`}{" "}
                    ·{" "}
                    {earned
                      ? `Recibido el ${new Date(`${earned.earned_on}T12:00:00Z`).toLocaleDateString("es", { timeZone: "UTC" })}`
                      : "Por descubrir, a tu ritmo"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
