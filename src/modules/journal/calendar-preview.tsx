"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmotionalCalendar } from "./calendar";
import { calendarDays } from "./actions";
import { monthRange } from "./dates";
import type { JournalDay } from "./types";
export function CalendarPreview({ timezone, currentDay }: { timezone: string; currentDay: string }) {
  const router = useRouter();
  const [month, setMonth] = useState("");
  const [today, setToday] = useState("");
  const [days, setDays] = useState<JournalDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    queueMicrotask(() => {
      const day = currentDay;
      setToday(day);
      setMonth(day.slice(0, 7));
    });
  }, [currentDay]);
  useEffect(() => {
    if (!month) return;
    let current = true;
    async function load() {
      setLoading(true);
      setError("");
      setDays([]);
      try {
        const result = await calendarDays({
          timezone,
          ...monthRange(month),
        });
        if (current) {
          if (result.ok) setDays(result.data);
          else setError(result.message);
        }
      } catch {
        if (current) setError("No se ha podido consultar el calendario.");
      } finally {
        if (current) setLoading(false);
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [month, revision, timezone]);
  return (
    <div>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {error}
            <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {month ? (
        <EmotionalCalendar
          today={today}
          month={month}
          days={days}
          selectedDay={null}
          loading={loading}
          onMonth={setMonth}
          onDay={(day) => router.push(`/journal/history?from=${day}&to=${day}`)}
        />
      ) : (
        <p role="status">Consultando calendario…</p>
      )}
    </div>
  );
}
