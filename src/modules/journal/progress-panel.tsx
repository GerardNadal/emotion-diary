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
  },
  {
    value: 5,
    title: "Tu propio ritmo",
    icon: Flame,
  },
  {
    value: 10,
    title: "Un hábito que florece",
    icon: Flower2,
  },
  {
    value: 30,
    title: "Un espacio que te acompaña",
    icon: Heart,
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
  return (
    <div className="insight-grid">
      <div className="evolution-stack">
        <section className="surface">
          <h2>Rachas</h2>
          <div className="streak-metrics">
            <div>
              <strong>{progress.current}</strong>
              <span>{progress.current === 1 ? "día laborable" : "días laborables"} de racha</span>
            </div>
            <div>
              <strong>{progress.best}</strong>
              <span>récord personal</span>
            </div>
          </div>
          <p className="metric-note">
            {progress.active_days} {progress.active_days === 1 ? "día laborable" : "días laborables"} con actividad.
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
        <h2>Logros</h2>
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
                      ? "Primer día laborable con actividad"
                      : `${m.value} días laborables consecutivos`}{" "}
                    ·{" "}
                    {earned
                      ? `Recibido el ${new Date(`${earned.earned_on}T12:00:00Z`).toLocaleDateString("es", { timeZone: "UTC" })}`
                      : "Pendiente"}
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
