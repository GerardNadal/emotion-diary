"use client";
import { useActionState, type ReactNode, type ComponentProps } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldGroup } from "@/components/ui/field";
import type { FormAction } from "@/modules/shared/action-state";

export function ActionForm({
  action,
  children,
  submitLabel,
  disabled = false,
  submitVariant = "default",
}: {
  action: FormAction;
  children: ReactNode;
  submitLabel: string;
  disabled?: boolean;
  submitVariant?: ComponentProps<typeof Button>["variant"];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction}>
      <FieldGroup>
        {children}
        {state.message ? (
          <Alert
            variant={state.ok ? "default" : "destructive"}
            aria-live="polite"
          >
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          variant={submitVariant}
          type="submit"
          disabled={pending || disabled}
        >
          {pending ? (
            <>
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
              Un momento…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
