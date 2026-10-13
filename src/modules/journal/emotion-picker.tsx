"use client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { emotions, type Emotion } from "./emotions";

export function EmotionPicker({
  value,
  onChange,
  invalid = false,
}: {
  value: Emotion | "";
  onChange: (value: Emotion | "") => void;
  invalid?: boolean;
}) {
  return (
    <ToggleGroup
      className="reason-picker"
      value={value ? [value] : []}
      onValueChange={(values) => onChange((values[0] as Emotion) ?? "")}
      aria-label="Emoción específica"
      aria-invalid={invalid}
      aria-describedby={invalid ? "emotion-error" : undefined}
    >
      {emotions.map((emotion) => (
        <ToggleGroupItem
          key={emotion.value}
          value={emotion.value}
          aria-label={emotion.label}
          variant="outline"
        >
          <span aria-hidden="true">{emotion.emoji}</span>
          <span>{emotion.label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
