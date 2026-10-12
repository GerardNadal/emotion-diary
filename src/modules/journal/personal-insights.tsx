import {
  ChartNoAxesColumnIncreasing,
  Sprout,
  Flame,
  Flower2,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { EmotionalCalendar } from "./calendar";

export function PersonalInsights({ today }: { today: string }) {
  return (
    <>
      <PageHeading
        title="Mi evolución"
        description="Conocerte lleva tiempo. Aquí podrás mirar tu camino con perspectiva."
      />
      <section className="surface">
        <h2>Cómo te has sentido</h2>
        <EmptyState
          icon={ChartNoAxesColumnIncreasing}
          title="Todavía no hay una evolución que mostrar"
          description="Tus gráficos personales se conectarán al diario en una próxima fase. No hay estadísticas ni emociones guardadas todavía."
        />
      </section>
      <div className="insight-grid">
        <EmotionalCalendar today={today} />
        <section className="surface">
          <h2>Pequeños pasos</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Recompensas previstas, aún sin activar.
          </p>
          <div className="reward-list">
            <div className="reward-row">
              <Sprout aria-hidden="true" />
              <div>
                <h3>Un primer momento para ti</h3>
                <p>Tu primera entrada · Pendiente</p>
              </div>
            </div>
            <div className="reward-row">
              <Flame aria-hidden="true" />
              <div>
                <h3>Crear tu propio ritmo</h3>
                <p>Tu racha personal · Pendiente</p>
              </div>
            </div>
            <div className="reward-row">
              <Flower2 aria-hidden="true" />
              <div>
                <h3>Un espacio que crece contigo</h3>
                <p>Tu recorrido en el diario · Pendiente</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            No hay objetivos obligatorios ni comparaciones con otras personas.
          </p>
        </section>
      </div>
    </>
  );
}
