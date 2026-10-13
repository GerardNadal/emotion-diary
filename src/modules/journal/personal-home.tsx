import Link from "next/link";
import { ArrowRight, Leaf } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { buttonVariants } from "@/components/ui/button";
import { MoodShortcuts } from "./mood-shortcuts";

export function PersonalHome({ name }: { name: string }) {
  return (
    <>
      <PageHeading
        title={`Hola, ${name.split(/\s+/)[0]}`}
        description="Un momento para ti, en medio de tu día."
      />
      <section className="mood-panel" aria-labelledby="mood-title">
        <h2 id="mood-title">¿Cómo te sientes hoy?</h2>
        <p>Todas las emociones tienen su lugar.</p>
        <MoodShortcuts />
        <Link className={buttonVariants()} href="/journal/new">
          Explorar mi diario
          <ArrowRight data-icon="inline-end" />
        </Link>
        <small>Vista previa · Las entradas todavía no se guardan</small>
      </section>
      <section className="week-section" aria-labelledby="week-title">
        <div className="section-heading">
          <h2 id="week-title">Tu semana, a tu ritmo</h2>
          <span className="streak-empty">
            <strong>—</strong>
            <span>Tu racha aparecerá aquí</span>
          </span>
        </div>
        <div className="week-days">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
            <div key={day}>
              <span>{day}</span>
              <span className="day-circle" aria-hidden="true" />
            </div>
          ))}
        </div>
        <p className="empty-inline">Todavía no hay registros.</p>
      </section>
      <section className="pause-band">
        <span className="round-icon">
          <Leaf aria-hidden="true" />
        </span>
        <div>
          <h2>Una pequeña pausa</h2>
          <p>No tienes que resolverlo todo hoy.</p>
        </div>
        <Link href="/recommendations">
          Ver recursos
          <ArrowRight aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
