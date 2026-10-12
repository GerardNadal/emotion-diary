import Link from "next/link";
export default function NotFound() {
  return <main className="mx-auto flex max-w-lg flex-col gap-4 p-8"><h1 className="text-xl font-semibold">Página no disponible</h1>
    <p>La página no existe o no está disponible para tu cuenta.</p><Link className="underline" href="/">Volver al inicio</Link></main>;
}
