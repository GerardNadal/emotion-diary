"use client";
import { useState } from "react";
import { ChartNoAxesColumnIncreasing, LockKeyhole } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Field, FieldLabel } from "@/components/ui/field";

export function AggregateInsights({
  company,
  teams,
}: {
  company: boolean;
  teams: { id: string; name: string }[];
}) {
  const [period, setPeriod] = useState("30");
  const [team, setTeam] = useState("");
  return (
    <section className="surface">
      <div className="view-toolbar">
        <h2>
          {company ? "Bienestar de la empresa" : "Bienestar de mis equipos"}
        </h2>
        <div className="flex flex-wrap gap-3">
          <Field className="w-auto">
            <FieldLabel className="sr-only" htmlFor="aggregate-team">
              Equipo
            </FieldLabel>
            <NativeSelect
              id="aggregate-team"
              value={team}
              onChange={(event) => setTeam(event.target.value)}
            >
              <NativeSelectOption value="">
                {company ? "Todos los equipos" : "Mis equipos"}
              </NativeSelectOption>
              {teams.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field className="w-auto">
            <FieldLabel className="sr-only" htmlFor="aggregate-period">
              Periodo
            </FieldLabel>
            <NativeSelect
              id="aggregate-period"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              <NativeSelectOption value="7">Últimos 7 días</NativeSelectOption>
              <NativeSelectOption value="30">
                Últimos 30 días
              </NativeSelectOption>
              <NativeSelectOption value="90">
                Últimos 90 días
              </NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>
      </div>
      <div aria-live="polite">
        <EmptyState
          icon={ChartNoAxesColumnIncreasing}
          title="Aún no hay estadísticas disponibles"
          description={`${team ? teams.find((item) => item.id === team)?.name : company ? "Toda la empresa" : "Tus equipos"} · Últimos ${period} días. Las tendencias y los factores laborales se conectarán en una próxima fase.`}
        />
      </div>
      <p className="privacy-callout">
        <LockKeyhole aria-hidden="true" />
        Solo información agregada. Los resultados se mostrarán cuando exista un
        volumen suficiente para proteger la privacidad.
      </p>
    </section>
  );
}
