"use client";
import { useState } from "react";
import { RecommendationPanel } from "./recommendation-panel";

export function RecommendationEntrySelector({ entries }: { entries: { id: string; label: string }[] }) {
  const [entryId, setEntryId] = useState(entries[0]?.id ?? "");
  return <RecommendationPanel
    key={entryId}
    entryId={entryId || undefined}
    entries={entries}
    onEntryChange={setEntryId}
    layout="cards"
  />;
}
