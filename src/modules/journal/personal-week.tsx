"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { personalEvolution } from "./evolution-actions";
import { browserTimezone, weekRange, shiftDay, isWorkday } from "./dates";
import { emotions } from "./emotions";
import type { Evolution } from "./evolution-types";

export function PersonalWeek() {
  const [data, setData] = useState<Evolution | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    async function load() {
      setError("");
      setData(null);
      try {
        const result = await personalEvolution({
          timezone: browserTimezone(),
          period: "7",
        });
        if (!current) return;
        if (result.ok) setData(result.data);
        else setError(result.message);
      } catch {
        if (current) setError("No se ha podido consultar tu semana.");
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [revision]);
  const from = data ? weekRange(data.progress.today).from : "";
  const activeWeekdays = data?.progress.week.filter(isWorkday).length ?? 0;
  const top =
    data?.statistics.distributions
      .filter((d) => d.kind === "emotion" && d.present)
      .sort((a, b) => b.count - a.count) ?? [];
  const leaders = top
    .filter((d) => d.count === top[0]?.count)
    .map((d) => emotions.find((e) => e.value === d.value)?.label)
    .join(", ");
  return (
    <section
      className="week-section"
      aria-labelledby="week-title"
      aria-busy={!data && !error}
    >
      <div className="section-heading">
        <h2 id="week-title">Tu semana</h2>
        <span className="streak-empty">
          <strong>{data?.progress.current ?? "—"}</strong>
          <span>{data?.progress.current === 1 ? "día laborable" : "días laborables"} de racha</span>
        </span>
      </div>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {error}
            <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : data ? (
        <>
          <div className="week-days">
            {["Lun", "Mar", "Mié", "Jue", "Vie"].map(
              (label, i) => {
                const day = shiftDay(from, i);
                const active = data.progress.week.includes(day);
                return (
                  <div key={day}>
                    <span>{label}</span>
                    <span
                      className="day-circle"
                      data-active={active}
                      aria-label={
                        day +
                        ": " +
                        (active ? "actividad válida" : "sin actividad")
                      }
                    >
                      {active ? "✓" : ""}
                    </span>
                  </div>
                );
              },
            )}
          </div>
          <p className="empty-inline">
            {activeWeekdays} {activeWeekdays === 1 ? "día laborable" : "días laborables"} con actividad esta semana.
          </p>
          <p className="metric-note">
            Últimos 7 días: {data.statistics.current.entries} entradas en{" "}
            {data.statistics.current.recorded_days} días.{" "}
            {leaders
              ? "Emoción más frecuente: " + leaders + "."
              : ""}
          </p>
        </>
      ) : (
        <p className="empty-inline" role="status">
          Consultando tu semana…
        </p>
      )}
      <Link
        href="/insights"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Ver mi evolución
      </Link>
    </section>
  );
}
