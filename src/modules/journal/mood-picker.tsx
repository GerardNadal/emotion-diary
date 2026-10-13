"use client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { moods, type Mood } from "./emotions";

export function MoodPicker({
  value,
  onChange,
  invalid = false,
}: {
  value: Mood | "";
  onChange: (value: Mood | "") => void;
  invalid?: boolean;
}) {
  return (
    <ToggleGroup
      className="emotion-picker"
      value={value ? [value] : []}
      onValueChange={(values) => onChange((values[0] as Mood) ?? "")}
      aria-label="Estado de ánimo"
      aria-invalid={invalid}
      aria-describedby={invalid ? "mood-error" : undefined}
    >
      {moods.map((mood) => (
        <ToggleGroupItem
          key={mood.value}
          value={mood.value}
          className="emotion-option"
          aria-label={mood.label}
          data-emotion={mood.color}
        >
          <span className="emotion-face" aria-hidden="true">
            {mood.emoji}
          </span>
          <span>{mood.label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
