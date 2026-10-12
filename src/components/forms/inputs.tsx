"use client";
import { useId, useState, type ComponentProps } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

export function TextField({
  label,
  ...props
}: ComponentProps<typeof Input> & { label: string }) {
  const id = useId();
  const [invalid, setInvalid] = useState(false);
  const errorId = `${id}-error`;
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        {...props}
        aria-invalid={invalid || props["aria-invalid"]}
        aria-describedby={
          [props["aria-describedby"], invalid ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onInvalid={(event) => {
          setInvalid(true);
          props.onInvalid?.(event);
        }}
        onChange={(event) => {
          setInvalid(false);
          props.onChange?.(event);
        }}
      />
      {invalid ? (
        <p id={errorId} className="field-error">
          Completa este campo con el formato indicado.
        </p>
      ) : null}
    </Field>
  );
}

export function SelectField({
  label,
  options,
  ...props
}: ComponentProps<typeof NativeSelect> & {
  label: string;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  const [invalid, setInvalid] = useState(false);
  const errorId = `${id}-error`;
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        {...props}
        aria-invalid={invalid || props["aria-invalid"]}
        aria-describedby={
          [props["aria-describedby"], invalid ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onInvalid={(event) => {
          setInvalid(true);
          props.onInvalid?.(event);
        }}
        onChange={(event) => {
          setInvalid(false);
          props.onChange?.(event);
        }}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {invalid ? (
        <p id={errorId} className="field-error">
          Selecciona una opción para continuar.
        </p>
      ) : null}
    </Field>
  );
}
