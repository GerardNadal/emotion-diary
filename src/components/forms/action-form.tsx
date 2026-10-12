"use client";
import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldGroup } from "@/components/ui/field";
import type { FormAction } from "@/modules/shared/action-state";

export function ActionForm({ action, children, submitLabel, disabled = false }: {
  action: FormAction; children: ReactNode; submitLabel: string; disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction}>
    <FieldGroup>
      {children}
      {state.message ? <Alert variant={state.ok ? "default" : "destructive"} aria-live="polite">
        <AlertDescription>{state.message}</AlertDescription>
      </Alert> : null}
      <Button type="submit" disabled={pending || disabled}>{pending ? "Guardando…" : submitLabel}</Button>
    </FieldGroup>
  </form>;
}
