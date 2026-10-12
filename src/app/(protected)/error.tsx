"use client";
import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
export default function ProtectedError({ reset }: { reset: () => void }) {
  return (
    <section className="surface">
      <EmptyState
        icon={TriangleAlert}
        title="No hemos podido cargar este espacio"
        description="Puedes volver a intentarlo. Si el problema continúa, contacta con la administración."
      >
        <Button onClick={reset}>Reintentar</Button>
      </EmptyState>
    </section>
  );
}
