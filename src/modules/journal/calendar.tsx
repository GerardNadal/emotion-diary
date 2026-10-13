"use client";
import { ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { moods, emotions } from "./emotions";
import type { JournalDay } from "./types";

export function EmotionalCalendar({
  today,
  month,
  days,
  selectedDay,
  loading,
  onMonth,
  onDay,
  activityDays,
}: {
  today: string;
  month: string;
  days: JournalDay[];
  selectedDay: string | null;
  loading: boolean;
  onMonth: (month: string) => void;
  onDay?: (day: string) => void;
  activityDays?: string[];
}) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1, 1));
  const length = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const start = (date.getUTCDay() + 6) % 7;
  const label = new Intl.DateTimeFormat("es", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  const byDay = new Map(days.map((d) => [d.day, d]));
  function move(offset: number) {
    onMonth(
      new Date(Date.UTC(year, number - 1 + offset, 1, 12))
        .toISOString()
        .slice(0, 7),
    );
  }
  return (
    <section
      className="surface"
      aria-label={activityDays ? "Calendario de actividad" : "Calendario emocional"}
      aria-busy={loading}
    >
      <div className="calendar-header">
        <h2 aria-live="polite">{label}</h2>
        <div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mes anterior"
            onClick={() => move(-1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMonth(today.slice(0, 7))}
          >
            Hoy
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mes siguiente"
            onClick={() => move(1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="calendar-grid">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((name) => (
          <span key={name} className="calendar-weekday">
            {name}
          </span>
        ))}
        {Array.from({ length: start }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, "0")}`;
          const info = byDay.get(day);
          const mood = moods.find((m) => m.value === info?.mood);
          if (activityDays) return (
            <div key={day} className={cn("calendar-day", day === today && "today", activityDays.includes(day) && "has-entries")}
              aria-label={`${i + 1} de ${label}: ${activityDays.includes(day) ? "actividad válida" : "sin actividad"}`}>
              <span>{i + 1}</span><span aria-hidden="true">{activityDays.includes(day) ? "✓" : ""}</span>
            </div>
          );
          const distinctMoods = info?.moods ?? (info ? [info.mood] : []);
          const distinctEmotions = info?.emotions ?? (info ? [info.emotion] : []);
          return (
            <button
              type="button"
              key={day}
              disabled={loading}
              onClick={() => onDay?.(day)}
              className={cn(
                "calendar-day",
                day === today && "today",
                selectedDay === day && "selected",
                info && "has-entries",
              )}
              aria-label={`${i + 1} de ${label}, ${info ? `${info.count} registros, ánimos: ${distinctMoods.map(v => moods.find(m => m.value === v)?.label).join(", ")}; emociones: ${distinctEmotions.map(v => emotions.find(e => e.value === v)?.label).join(", ")}; último ánimo: ${mood?.label}` : "sin registros"}`}
              aria-current={day === today ? "date" : undefined}
              aria-pressed={selectedDay === day}
            >
              <span>{i + 1}</span>
              {info ? (
                <>
                  <span aria-hidden="true" className="calendar-moods">{distinctMoods.map(v => <span key={v}>{moods.find(m => m.value === v)?.emoji}</span>)}</span>
                  <small>{info.count}</small>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="calendar-note">
        <Circle aria-hidden="true" />
        {loading
          ? "Consultando el mes…"
          : activityDays ? "Días con actividad"
          : "El número indica las entradas del día."}
      </p>
    </section>
  );
}
