import {
  moods,
  emotions,
  intensities,
  categoryLabel,
  reasonLabel,
} from "./emotions";
import { descriptiveTrend } from "./evolution";
import { statisticsDayCount } from "./dates";
import type { Statistics } from "./evolution-types";

export function dayLabel(day: string) {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
const number = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("es", { maximumFractionDigits: 2 });

function Timeline({
  stats,
  metric,
}: {
  stats: Statistics;
  metric: "mood_average" | "intensity_average";
}) {
  const mood = metric === "mood_average";
  const labels = mood ? moods.map((m) => m.label) : [...intensities];
  const x = (i: number) => 106 + (i / Math.max(1, stats.days.length - 1)) * 614;
  const y = (v: number) => 170 - (v - 1) * 35;
  const segments: string[][] = [];
  stats.days.forEach((d, i) => {
    if (d[metric] === null) return;
    if (i === 0 || stats.days[i - 1][metric] === null) segments.push([]);
    segments[segments.length - 1].push(`${x(i)},${y(d[metric]!)}`);
  });
  return (
    <section className="surface evolution-chart">
      <h2>
        {mood
          ? "Ánimo diario"
          : "Intensidad diaria"}
      </h2>
      <p className="metric-note">
        Media de las entradas de cada día.
      </p>
      <svg
        viewBox="0 0 760 212"
        role="img"
        aria-label={`${mood ? "Ánimo" : "Intensidad"} medio diario del ${stats.from} al ${stats.to}. Los días sin registros son huecos. Los valores exactos están en la tabla de datos.`}
      >
        {labels.map((label, i) => (
          <g key={label}>
            <line
              x1="106"
              x2="720"
              y1={y(i + 1)}
              y2={y(i + 1)}
              className="chart-gridline"
            />
            <text x="96" y={y(i + 1) + 4} textAnchor="end">
              {label}
            </text>
          </g>
        ))}
        {segments.map((points, i) => (
          <polyline
            key={i}
            points={points.join(" ")}
            fill="none"
            className={mood ? "chart-mood" : "chart-intensity"}
          />
        ))}
        {stats.days.map((d, i) =>
          d[metric] !== null ? (
            <circle
              key={d.day}
              cx={x(i)}
              cy={y(d[metric]!)}
              r="4"
              className={mood ? "chart-mood" : "chart-intensity"}
            >
              <title>
                {dayLabel(d.day)}: {number(d[metric])}/5 · {d.count} entradas
              </title>
            </circle>
          ) : null,
        )}
        <text x="106" y="204">
          {dayLabel(stats.from)}
        </text>
        <text x="720" y="204" textAnchor="end">
          {dayLabel(stats.to)}
        </text>
      </svg>
      <p className="metric-note">
        Huecos: días sin registros.
      </p>
    </section>
  );
}

function Distribution({
  stats,
  kind,
}: {
  stats: Statistics;
  kind: "emotion" | "intensity";
}) {
  const options =
    kind === "emotion"
      ? emotions.map((e) => ({
          value: e.value as string,
          label: `${e.emoji} ${e.label}`,
        }))
      : intensities.map((label, i) => ({
          value: String(i + 1),
          label: `${i + 1} · ${label}`,
        }));
  const count = (value: string, present: boolean) =>
    stats.distributions.find(
      (d) => d.kind === kind && d.value === value && d.present === present,
    )?.count ?? 0;
  if (kind === "emotion")
    options.sort((a, b) => count(b.value, true) - count(a.value, true));
  return (
    <section className="surface">
      <h2>
        {kind === "emotion"
          ? "Emociones"
          : "Intensidad de tus registros"}
      </h2>
      <p className="metric-note">
        Porcentaje de entradas.
      </p>
      <div className="distribution-list">
        {options.map((o) => {
          const n = count(o.value, true);
          const pct = stats.current.entries
            ? (n / stats.current.entries) * 100
            : 0;
          const previous = stats.previous.entries
            ? (count(o.value, false) / stats.previous.entries) * 100
            : null;
          return (
            <div key={o.value} className="distribution-row">
              <div>
                <span>{o.label}</span>
                <span>
                  {n} · {Math.round(pct)}%
                </span>
              </div>
              <div className="distribution-track" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </div>
              <small>
                Período anterior:{" "}
                {previous === null
                  ? "sin registros"
                  : `${Math.round(previous)}%`}
              </small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function EvolutionCharts({ stats }: { stats: Statistics }) {
  const most = stats.distributions
    .filter((d) => d.present && d.kind === "emotion")
    .sort((a, b) => b.count - a.count);
  const leaders = most
    .filter((d) => d.count === most[0]?.count)
    .map((d) => emotions.find((e) => e.value === d.value)?.label)
    .join(", ");
  return (
    <>
      <div className="evolution-metrics">
        <section className="surface">
          <strong>{stats.current.entries}</strong>
          <h2>Entradas emocionales</h2>
          <p className="metric-note">
            {stats.previous.entries} en el período anterior
          </p>
        </section>
        <section className="surface">
          <strong>{stats.current.recorded_days}</strong>
          <h2>Días con registros</h2>
          <p className="metric-note">
            De {statisticsDayCount(stats.days)} días
          </p>
        </section>
        <section className="surface">
          <h2>Más frecuente</h2>
          <p className="frequent-emotion">{leaders || "Aún sin registros"}</p>
          <p className="metric-note">
            {most[0]
              ? `${most[0].count} entradas por emoción${most.filter((d) => d.count === most[0].count).length > 1 ? " · frecuencia compartida" : ""}`
              : ""}
          </p>
        </section>
      </div>
      <section className="surface trend-note">
        <h2>Tendencia</h2>
        <p>{descriptiveTrend(stats)}</p>
      </section>
      {!stats.current.entries ? (
        <section className="surface">
          <h2>Sin entradas en este período</h2>
          <p className="metric-note">
            Selecciona otro período o registra una entrada.
          </p>
        </section>
      ) : (
        <>
          <Timeline stats={stats} metric="mood_average" />
          <section className="surface">
            <h2>Distribución del ánimo</h2>
            <div className="mood-distribution">
              {moods.map((m) => {
                const n =
                  stats.distributions.find(
                    (d) =>
                      d.kind === "mood" && d.present && d.value === m.value,
                  )?.count ?? 0;
                return (
                  <div key={m.value}>
                    <span>
                      {m.emoji} {m.label}
                    </span>
                    <strong>{n}</strong>
                    <small>
                      {Math.round((n / stats.current.entries) * 100)}% de
                      entradas
                    </small>
                  </div>
                );
              })}
            </div>
          </section>
          <div className="insight-grid">
            <Distribution stats={stats} kind="emotion" />
            <Distribution stats={stats} kind="intensity" />
          </div>
          <Timeline stats={stats} metric="intensity_average" />
          <section className="surface">
            <h2>Motivos más frecuentes</h2>
            <p className="metric-note">
              Los ocho motivos más registrados.
            </p>
            {stats.triggers.length ? (
              <ol className="trigger-list">
                {stats.triggers.map((t, i) => (
                  <li key={i}>
                    <div>
                      <strong>
                        {t.custom ||
                          (t.reason
                            ? reasonLabel(t.reason)
                            : categoryLabel(t.category))}
                      </strong>
                      <small>
                        {categoryLabel(t.category)}
                        {t.custom && t.reason
                          ? ` · ${reasonLabel(t.reason)}`
                          : ""}
                      </small>
                    </div>
                    <span>{t.count} entradas</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="metric-note">Todavía no has indicado motivos.</p>
            )}
            <p className="metric-note">
              {stats.without_trigger} entradas sin motivo indicado.
            </p>
          </section>
        </>
      )}
      <section className="surface">
        <h2>Comparación de períodos</h2>
        <p className="metric-note">
          {dayLabel(stats.from)} – {dayLabel(stats.to)} frente a{" "}
          {dayLabel(stats.previous_from)} – {dayLabel(stats.previous_to)} (
          {stats.days.length} días cada uno).
        </p>
        <div className="evolution-table">
          <table>
            <thead>
              <tr>
                <th>Indicador</th>
                <th>Actual</th>
                <th>Anterior</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Entradas", key: "entries" },
                { label: "Días con registros", key: "recorded_days" },
                { label: "Ánimo medio · escala 1–5", key: "mood_average" },
                {
                  label: "Intensidad media · escala 1–5",
                  key: "intensity_average",
                },
              ].map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  <td>
                    {number(
                      stats.current[row.key as keyof typeof stats.current],
                    )}
                  </td>
                  <td>
                    {number(
                      stats.previous[row.key as keyof typeof stats.previous],
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="metric-note">
          Cada día registrado tiene el mismo peso en las medias del período. El
          ánimo es una escala orientativa: 1 = muy mal, 5 = muy bien. La
          intensidad mide fuerza emocional, no bienestar.
        </p>
      </section>
      <details className="surface metric-method">
        <summary>Cálculo y datos diarios</summary>
        <p className="metric-note">
          Usamos la fecha emocional y tu zona horaria guardada. Todas las
          entradas del día participan en su media; un día con muchas entradas no
          pesa más en la media del período. Las frecuencias sí cuentan cada
          entrada. No se imputan días vacíos. Las ediciones y eliminaciones
          actualizan las estadísticas. Comparamos con el período inmediatamente
          anterior de igual duración y describimos cambios solo con al menos
          tres días registrados en ambos períodos. Estos datos no son un
          diagnóstico.
        </p>
        <div className="evolution-table">
          <table>
            <caption>Datos diarios · {stats.timezone}</caption>
            <thead>
              <tr>
                <th>Día</th>
                <th>Entradas</th>
                <th>Ánimo · 1–5</th>
                <th>Intensidad · 1–5</th>
              </tr>
            </thead>
            <tbody>
              {stats.days.map((d) => (
                <tr key={d.day}>
                  <th scope="row">{d.day}</th>
                  <td>{d.count}</td>
                  <td>{number(d.mood_average)}</td>
                  <td>{number(d.intensity_average)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
