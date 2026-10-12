"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmotionalCalendar({ today }: { today: string }) {
  const [year, month, day] = today.split("-").map(Number);
  const [offset, setOffset] = useState(0);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  const currentYear = date.getUTCFullYear();
  const currentMonth = date.getUTCMonth();
  const length = new Date(
    Date.UTC(currentYear, currentMonth + 1, 0),
  ).getUTCDate();
  const start = (date.getUTCDay() + 6) % 7;
  const label = new Intl.DateTimeFormat("es", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return (
    <section className="surface" aria-label="Calendario emocional">
      <div className="calendar-header">
        <h2 aria-live="polite">{label}</h2>
        <div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mes anterior"
            onClick={() => setOffset((value) => value - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>
            Hoy
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mes siguiente"
            onClick={() => setOffset((value) => value + 1)}
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
        {Array.from({ length: start }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" />
        ))}
        {Array.from({ length }, (_, index) => {
          const number = index + 1;
          const isToday = offset === 0 && number === day;
          return (
            <div
              key={number}
              className={cn("calendar-day", isToday && "today")}
              aria-label={`${number} de ${label}, sin datos emocionales${isToday ? ", hoy" : ""}`}
              aria-current={isToday ? "date" : undefined}
            >
              {number}
            </div>
          );
        })}
      </div>
      <p className="calendar-note">
        <Circle aria-hidden="true" />
        Sin datos emocionales · El diario estará disponible en una próxima fase.
      </p>
    </section>
  );
}
