import { useId, type ComponentProps } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function TextField({ label, ...props }: ComponentProps<typeof Input> & { label: string }) {
  const id = useId();
  return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel><Input id={id} {...props} /></Field>;
}

export function SelectField({ label, options, ...props }: ComponentProps<typeof NativeSelect> & {
  label: string; options: { value: string; label: string }[];
}) {
  const id = useId();
  return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel>
    <NativeSelect id={id} {...props}>
      {options.map((option) => <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>)}
    </NativeSelect>
  </Field>;
}
