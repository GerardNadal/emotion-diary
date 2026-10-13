import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { collectiveTrendSummary, positiveShare, type ReportingResult } from "./reporting-model";

export function ReportingSummary({ result, periodLabel, scope }: {
  result: ReportingResult;
  periodLabel: string;
  scope: string;
}) {
  const stats = result.data;
  const current = stats?.current;
  const published = current?.status === "published" ? current : null;
  const favorable = current ? positiveShare(current) : null;
  const participation = published?.participation.status === "published" ? published.participation.percent : null;
  const provenance = published?.source === "demo"
    ? "Datos de demostración"
    : published?.source === "mixed" ? "Incluye datos de demostración" : "";

  return <section className="surface wellbeing-summary" aria-labelledby="wellbeing-summary-heading">
    <div className="section-heading">
      <h2 id="wellbeing-summary-heading">Bienestar</h2>
      <Link href="/admin/insights" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Ver análisis completo
        <ArrowRight data-icon="inline-end" />
      </Link>
    </div>
    <p className="metric-note">{scope} · {periodLabel}{provenance ? ` · ${provenance}` : ""}</p>
    {result.error ? <p role="alert" className="field-error">{result.error}</p> : !published || !stats ? (
      <p className="metric-note">Datos insuficientes para este período.</p>
    ) : (
      <dl className="wellbeing-summary-metrics">
        <div>
          <dt>Ánimo favorable</dt>
          <dd>{favorable === null ? "Datos insuficientes" : `≈ ${favorable}%`}</dd>
        </div>
        <div>
          <dt>Participación</dt>
          <dd>{participation === null ? "Datos insuficientes" : `≈ ${participation}%`}</dd>
        </div>
        <div>
          <dt>Tendencia</dt>
          <dd>{collectiveTrendSummary(stats.current, stats.previous)}</dd>
        </div>
      </dl>
    )}
  </section>;
}
