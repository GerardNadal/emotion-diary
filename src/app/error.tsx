"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto flex max-w-lg flex-col gap-4 p-8"><h1 className="text-xl font-semibold">No se ha podido cargar la página</h1>
    <p>Inténtalo otra vez. Si continúa, contacta con la administración.</p>
    <Button onClick={reset}>Reintentar</Button><Link href="/login" className="underline">Ir al acceso</Link></main>;
}
