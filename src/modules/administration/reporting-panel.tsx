"use client";
import { useState, useTransition } from "react";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { moods, emotions, intensities, categoryLabel, reasonLabel } from "@/modules/journal/emotions";
import { loadCollectiveStatistics } from "./reporting-actions";
import { collectiveTrend, positiveShare, publishedValues, type CollectiveData, type DimensionKind, type ReportingQuery, type ReportingResult, type allowedPeriods } from "./reporting-model";

function label(kind: DimensionKind, value: string) {
  if (kind === "mood") return moods.find((m) => m.value === value)?.label ?? value;
  if (kind === "emotion") return emotions.find((e) => e.value === value)?.label ?? value;
  if (kind === "intensity") return intensities[Number(value) - 1] ?? value;
  if (value === "unreported") return "Sin factor laboral del catálogo";
  return kind === "factor" ? categoryLabel(value) : reasonLabel(value);
}
function Bars({ data, previous, kind, title }: { data: CollectiveData; previous: CollectiveData; kind: DimensionKind; title: string }) {
  const values = publishedValues(data, kind);
  const before = publishedValues(previous, kind);
  const all = kind === "mood" ? moods.map((m) => m.value) : kind === "intensity" ? ["1", "2", "3", "4", "5"] : kind === "emotion" ? emotions.map((e) => e.value) : values?.toSorted((a, b) => b.percent - a.percent).map((v) => v.value) ?? [];
  return <section className="surface collective-chart"><h2>{title}</h2>
    {!values ? <p className="metric-note">Datos insuficientes.</p> : <>
      <p className="metric-note">Porcentajes redondeados a 10 puntos; pueden no sumar 100%.</p>
      <div className="distribution-list">{all.map((value) => {
        const pct = values.find((v) => v.value === value)?.percent ?? 0;
        const old = before ? before.find((v) => v.value === value)?.percent ?? 0 : null;
        return <div className="distribution-row" key={value}><div><span>{label(kind, value)}</span><strong>≈ {pct}%</strong></div>
          <div className="distribution-track" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
          <small>Anterior: {old === null ? "datos insuficientes" : `≈ ${old}%`}</small></div>;
      })}</div></>}
  </section>;
}
export function ReportingPanel({ company, teams, periods, initial, initialQuery }: {
  company: boolean; teams: { id: string; name: string }[]; periods: ReturnType<typeof allowedPeriods>;
  initial: ReportingResult; initialQuery: ReportingQuery;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState(initial);
  const [pending, startTransition] = useTransition();
  function load(next: ReportingQuery) {
    setQuery(next);
    startTransition(async () => {
      try { setResult(await loadCollectiveStatistics(next)); }
      catch { setResult({ data: null, error: "No se han podido cargar las estadísticas. Inténtalo de nuevo." }); }
    });
  }
  const stats = result.data;
  return <div className="collective-dashboard" aria-busy={pending}>
    <section className="surface">
      <div className="view-toolbar"><h2>{company ? "Clima emocional de la empresa" : "Clima emocional de mis equipos"}</h2>
        <div className="collective-filters">
          <Field><FieldLabel htmlFor="aggregate-team">Equipo</FieldLabel><NativeSelect id="aggregate-team" value={query.team ?? ""} disabled={pending || !teams.length} onChange={(e) => load({ ...query, team: e.target.value || null })}>
            {company ? <NativeSelectOption value="">Empresa · equipos publicables</NativeSelectOption> : null}
            {!company && !teams.length ? <NativeSelectOption value="">Sin equipos asignados</NativeSelectOption> : null}
            {teams.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
          </NativeSelect></Field>
          <Field><FieldLabel htmlFor="aggregate-period">Período completo</FieldLabel><NativeSelect id="aggregate-period" disabled={pending || (!company && !teams.length)} value={`${query.grain}:${query.period}`} onChange={(e) => {
            const [grain, period] = e.target.value.split(":"); load({ ...query, grain: grain as ReportingQuery["grain"], period });
          }}>{periods.map((p) => <NativeSelectOption key={`${p.grain}:${p.period}`} value={`${p.grain}:${p.period}`}>{p.label}</NativeSelectOption>)}</NativeSelect></Field>
        </div>
      </div>
      {!pending && stats?.current.status === "published" && stats.current.source !== "live" && stats.current.source ? <Alert><AlertTitle>{stats.current.source === "demo" ? "Datos ficticios de demostración" : "Este resumen incluye datos ficticios de demo"}</AlertTitle><AlertDescription>La procedencia del historial demo se ha verificado contra el generador. Estas cifras permiten probar los gráficos y no describen el clima emocional real de la empresa.</AlertDescription></Alert> : null}
      {company && query.team === null ? <p className="metric-note">Solo equipos con datos publicables. Los equipos incluidos pueden variar entre períodos.</p> : null}
    </section>
    <div aria-live="polite">
      {pending ? <section className="surface"><p>Cargando estadísticas protegidas…</p><Skeleton className="h-32 w-full" /></section> : result.error ?
        <Alert variant="destructive"><AlertTitle>No se han podido cargar los datos</AlertTitle><AlertDescription>{result.error}<Button variant="outline" onClick={() => load(query)}>Reintentar</Button></AlertDescription></Alert> : !stats || stats.current.status === "insufficient_data" ?
        <section className="surface"><EmptyState icon={ChartNoAxesColumnIncreasing} title="Datos insuficientes" description="No hay datos publicables para este grupo y período." /></section> :
        <section className="surface"><h2>Tendencia del entorno laboral</h2><p>{collectiveTrend(stats.current, stats.previous)}</p><p className="metric-note">Participación: {stats.current.participation.status === "published" ? `≈ ${stats.current.participation.percent}% de empleados activos del grupo estable` : "datos insuficientes"}.</p></section>}
    </div>
    {!pending && !result.error && stats ? <>
      <div className="insight-grid"><Bars title="Distribución del estado de ánimo" kind="mood" data={stats.current} previous={stats.previous} /><Bars title="Factores laborales" kind="factor" data={stats.current} previous={stats.previous} /></div>
      <section className="surface"><h2>Evolución por períodos completos</h2><p className="metric-note">Ánimo favorable: Bien y Muy bien.</p>
        <div className="collective-timeline" role="img" aria-label="Evolución de la proporción aproximada de ánimo favorable; los valores aparecen bajo cada barra.">
          {stats.timeline.map((point) => { const pct = positiveShare(point.data); return <div key={point.period}><div className="collective-timeline-track">{pct !== null ? <span style={{ height: `${pct}%` }} /> : null}</div><strong>{pct === null ? "—" : `≈ ${pct}%`}</strong><small>{query.grain === "month" ? point.period.slice(0, 7) : `${point.period.slice(0, 4)} · T${Math.floor((Number(point.period.slice(5, 7)) - 1) / 3) + 1}`}</small></div>; })}
        </div><p className="metric-note">— indica datos insuficientes.</p>
      </section>
      <details className="surface"><summary>Emociones, intensidad y motivos laborales</summary><div className="insight-grid"><Bars title="Emociones específicas" kind="emotion" data={stats.current} previous={stats.previous} /><Bars title="Intensidad emocional" kind="intensity" data={stats.current} previous={stats.previous} /><Bars title="Motivos laborales del catálogo" kind="reason" data={stats.current} previous={stats.previous} /></div><p className="metric-note">La intensidad expresa fuerza emocional, no bienestar. Los motivos no establecen causas; no se incluyen motivos personalizados ni factores de salud o vida privada.</p></details>
      <details className="surface"><summary>Evolución de los factores laborales</summary><div className="evolution-table"><table><thead><tr><th>Período</th><th>Factores aproximados</th></tr></thead><tbody>{stats.timeline.map((p) => <tr key={p.period}><th scope="row">{p.period.slice(0, 7)}</th><td>{publishedValues(p.data, "factor")?.map((v) => `${label("factor", v.value)} ≈ ${v.percent}%`).join(" · ") ?? "Datos insuficientes"}</td></tr>)}</tbody></table></div></details>
      {company && query.team === null ? <details className="surface"><summary>Tendencias entre equipos</summary><p className="metric-note">Sin clasificaciones de rendimiento. Los equipos protegidos no muestran cifras.</p><div className="evolution-table"><table><thead><tr><th>Equipo</th><th>Ánimo favorable aproximado</th></tr></thead><tbody>{stats.teams.map((t) => <tr key={t.name}><th scope="row">{t.name}</th><td>{positiveShare(t.data) === null ? "Datos insuficientes" : `≈ ${positiveShare(t.data)}%`}</td></tr>)}</tbody></table></div></details> : null}
    </> : null}
    <details className="surface metric-method"><summary>Cómo protegemos y calculamos los indicadores</summary><p className="metric-note">Cada participante tiene el mismo peso. Primero promediamos sus entradas por día y después sus días activos por mes, en Europe/Madrid. El umbral mínimo inicial es 3 participantes reales; las categorías y sus complementos también deben alcanzarlo. Una categoría pequeña protege toda su distribución.</p><p className="metric-note">Los trimestres reutilizan los meses publicados. Si cambia la composición del equipo, el historial anterior queda protegido. Una edición, eliminación o nueva entrada histórica retira una publicación existente: no ofrecemos dos versiones que permitan restar resultados. Los períodos anteriores al inicio de la trazabilidad no se publican.</p><p className="metric-note">Estas métricas describen tendencias del entorno laboral, no diagnósticos, productividad ni desempeño individual.</p></details>
  </div>;
}
