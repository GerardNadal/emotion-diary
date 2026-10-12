"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-7 py-16">
      <Brand />
      <h1 className="text-2xl font-semibold">
        No hemos podido cargar este espacio
      </h1>
      <p className="text-sm text-muted-foreground">
        Inténtalo otra vez. Si el problema continúa, contacta con la
        administración.
      </p>
      <Button onClick={reset}>Reintentar</Button>
      <Link href="/login" className="underline">
        Ir al acceso
      </Link>
    </main>
  );
}
