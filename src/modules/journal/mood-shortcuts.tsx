import Link from "next/link";
import { moods, newEntryForMood } from "./emotions";

export function MoodShortcuts() {
  return (
    <div
      className="emotion-picker"
      role="group"
      aria-label="Registrar mi estado de ánimo"
    >
      {moods.map((mood) => (
        <Link
          key={mood.value}
          href={newEntryForMood(mood.value)}
          className="emotion-option"
          aria-label={mood.label}
          data-emotion={mood.color}
        >
          <span className="emotion-face" aria-hidden="true">
            {mood.emoji}
          </span>
          <span>{mood.label}</span>
        </Link>
      ))}
    </div>
  );
}
