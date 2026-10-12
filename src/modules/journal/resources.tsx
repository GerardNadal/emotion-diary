import { Leaf, Sparkles, Music2 } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";

export function PersonalResources() {
  return (
    <>
      <PageHeading
        title="Un espacio para reconectar"
        description="Pequeñas pausas que puedes hacer tuyas."
      />
      <div className="resources">
        <section className="resource-panel mint">
          <div className="resource-title">
            <Leaf aria-hidden="true" />
            <h2>Vuelve a este momento</h2>
          </div>
          <p>
            Si te apetece, haz una pausa breve. No tienes que hacer nada
            especial.
          </p>
          <details>
            <summary>Una pausa sencilla</summary>
            <ol>
              <li>Deja lo que estás haciendo por un momento.</li>
              <li>Busca una postura cómoda y respira a tu ritmo.</li>
              <li>Observa cómo te encuentras, sin intentar cambiarlo.</li>
            </ol>
          </details>
        </section>
        <section className="resource-panel lavender">
          <div className="resource-title">
            <Sparkles aria-hidden="true" />
            <h2>Recomendaciones para ti</h2>
          </div>
          <p>
            Aquí encontrarás sugerencias personalizadas a partir de tu propio
            diario. La integración de IA todavía no está activa.
          </p>
          <Badge variant="secondary">Próximamente</Badge>
        </section>
        <section className="resource-panel peach">
          <div className="resource-title">
            <Music2 aria-hidden="true" />
            <h2>Encuentra tu sintonía</h2>
          </div>
          <p>
            Un lugar para descubrir música que acompañe tu momento. La selección
            musical se conectará en una próxima fase.
          </p>
          <Badge variant="outline">Próximamente</Badge>
        </section>
      </div>
    </>
  );
}
