"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { CalendarPreview } from "./calendar-preview";
import { EvolutionCharts } from "./evolution-charts";
import { ProgressPanel } from "./progress-panel";
import { personalEvolution, journalTimezone } from "./evolution-actions";
import { browserTimezone } from "./dates";
import type { Evolution } from "./evolution-types";

export function PersonalInsights() {
  const [draft, setDraft] = useState({ period: "30", from: "", to: "" });
  const [query, setQuery] = useState(draft);
  const [data, setData] = useState<Evolution | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [zone, setZone] = useState("");
  const [zoneError, setZoneError] = useState("");
  const [savingZone, setSavingZone] = useState(false);
  useEffect(() => {
    let current = true;
    async function load() {
      setData(null);
      setError("");
      try {
        const result = await personalEvolution({
          timezone: browserTimezone(),
          period: query.period,
          ...(query.period === "custom"
            ? { from: query.from, to: query.to }
            : {}),
        });
        if (!current) return;
        if (result.ok) {
          setData(result.data);
          setZone(result.data.progress.timezone);
        } else setError(result.message);
      } catch {
        if (current) setError("No se ha podido consultar tu evolución.");
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [query, revision]);
  function apply(event: FormEvent) {
    event.preventDefault();
    setQuery({ ...draft });
  }
  async function saveZone(event: FormEvent) {
    event.preventDefault();
    setSavingZone(true);
    setZoneError("");
    try {
      const result = await journalTimezone(zone, true);
      if (result.ok) setRevision((v) => v + 1);
      else setZoneError(result.message);
    } catch {
      setZoneError("No se ha podido guardar la zona horaria.");
    } finally {
      setSavingZone(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Mi evolución"
        description="Mira tu camino con perspectiva."
        action={
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/journal/new"
          >
            Registrar un momento
          </Link>
        }
      />
      <form className="surface evolution-filters" onSubmit={apply}>
        <Field>
          <FieldLabel htmlFor="evolution-period">Período emocional</FieldLabel>
          <NativeSelect
            id="evolution-period"
            value={draft.period}
            onChange={(e) => {
              const next = { ...draft, period: e.target.value };
              setDraft(next);
              if (next.period !== "custom") setQuery(next);
            }}
          >
            <NativeSelectOption value="7">
              Última semana · 7 días
            </NativeSelectOption>
            <NativeSelectOption value="30">
              Último mes · 30 días
            </NativeSelectOption>
            <NativeSelectOption value="90">
              Últimos tres meses · 90 días
            </NativeSelectOption>
            <NativeSelectOption value="custom">
              Personalizado
            </NativeSelectOption>
          </NativeSelect>
        </Field>
        {draft.period === "custom" ? (
          <>
            <Field>
              <FieldLabel htmlFor="evolution-from">Desde</FieldLabel>
              <Input
                id="evolution-from"
                type="date"
                required
                min="1901-01-01"
                max="2199-12-31"
                value={draft.from}
                onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="evolution-to">Hasta</FieldLabel>
              <Input
                id="evolution-to"
                type="date"
                required
                min="1901-01-01"
                max="2199-12-31"
                value={draft.to}
                onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              />
            </Field>
            <Button type="submit">Consultar período</Button>
          </>
        ) : null}
      </form>
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
        <div className="evolution-stack">
          <p className="metric-note" role="status">
            Del {data.statistics.from} al {data.statistics.to} ·{" "}
            {data.progress.timezone}
          </p>
          <EvolutionCharts stats={data.statistics} />
          <section aria-labelledby="emotional-calendar-heading">
            <h2
              id="emotional-calendar-heading"
              className="evolution-section-heading"
            >
              Calendario emocional
            </h2>
            <p className="metric-note">
              Selecciona un día para ver sus entradas.
            </p>
            <CalendarPreview
              key={data.progress.timezone}
              timezone={data.progress.timezone}
              currentDay={data.progress.today}
            />
          </section>
          <section aria-labelledby="activity-heading">
            <h2 id="activity-heading" className="evolution-section-heading">
              Actividad
            </h2>
            <p className="metric-note">
              Días de actividad, según cuándo creaste o completaste una entrada.
            </p>
            <ProgressPanel
              key={data.progress.timezone}
              initial={data.progress}
            />
          </section>
          <details className="surface">
            <summary>Tu zona horaria</summary>
            <p className="metric-note">
              El cambio agrupa las entradas en la nueva zona. Los días de actividad anteriores conservan su fecha.
            </p>
            <form className="evolution-filters" onSubmit={saveZone}>
              <Field>
                <FieldLabel htmlFor="personal-timezone">
                  Zona horaria (IANA)
                </FieldLabel>
                <Input
                  id="personal-timezone"
                  list="timezone-options"
                  value={zone}
                  required
                  maxLength={100}
                  onChange={(e) => setZone(e.target.value)}
                />
                <datalist id="timezone-options">
                  {[
                    "Europe/Madrid",
                    "UTC",
                    "America/New_York",
                    "America/Mexico_City",
                    "America/Bogota",
                    "America/Argentina/Buenos_Aires",
                    "Asia/Tokyo",
                  ].map((tz) => (
                    <option key={tz} value={tz} />
                  ))}
                </datalist>
              </Field>
              <Button type="submit" disabled={savingZone}>
                {savingZone ? "Guardando…" : "Guardar zona horaria"}
              </Button>
            </form>
            {zoneError ? (
              <p role="alert" className="field-error">
                {zoneError}
              </p>
            ) : null}
          </details>
        </div>
      ) : (
        <p role="status">Consultando tu evolución…</p>
      )}
    </>
  );
}
