import { Brand } from "@/components/brand";
import { emotions } from "@/modules/journal/emotions";

export const dynamic = "force-dynamic";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div>
          <h1>
            Un momento para ti.
            <br />
            Un espacio para sentir.
          </h1>
          <p>
            Escucha cómo estás, encuentra tu ritmo y dale espacio a lo que
            sientes.
          </p>
          <div className="auth-emotions" aria-hidden="true">
            {emotions.map((emotion) => (
              <span key={emotion.value} data-emotion={emotion.color}>
                {emotion.emoji}
              </span>
            ))}
          </div>
        </div>
        <small className="auth-access-note">
          Tu diario es privado. También frente a la administración.
        </small>
      </section>
      <section className="auth-content">
        <div>
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          {children}
          <p className="auth-access-note">
            Acceso exclusivo para las cuentas creadas por la empresa.
          </p>
        </div>
      </section>
    </main>
  );
}
