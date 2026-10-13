import { Brand } from "@/components/brand";
import { moods } from "@/modules/journal/emotions";

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
          <div className="auth-emotions" aria-hidden="true">
            {moods.map((mood) => (
              <span key={mood.value} data-emotion={mood.color}>
                {mood.emoji}
              </span>
            ))}
          </div>
        </div>
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
