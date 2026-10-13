import Link from "next/link";
import { ArrowRight, Leaf } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { buttonVariants } from "@/components/ui/button";
import { MoodShortcuts } from "./mood-shortcuts";
import { PersonalWeek } from "./personal-week";

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
          Registrar cómo me siento
          <ArrowRight data-icon="inline-end" />
        </Link>
      </section>
      <PersonalWeek />
      <section className="pause-band">
        <span className="round-icon">
          <Leaf aria-hidden="true" />
        </span>
        <div>
          <h2>Una pequeña pausa</h2>
        </div>
        <Link href="/recommendations">
          Ver recursos
          <ArrowRight aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
