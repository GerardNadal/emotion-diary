export const dynamic = "force-dynamic";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-1"><h1 className="text-2xl font-semibold">Diario emocional</h1>
        <p className="text-sm text-muted-foreground">Tu espacio privado de bienestar.</p></div>
      {children}
      <p className="text-sm text-muted-foreground">Acceso exclusivo para las cuentas creadas por la empresa.</p>
    </div>
  </main>;
}
