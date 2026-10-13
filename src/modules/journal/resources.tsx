import { PageHeading } from "@/components/page-heading";
import { RecommendationEntrySelector } from "@/modules/ai/entry-selector";

export function PersonalResources({ entries, error }: { entries: { id: string; label: string }[]; error?: string }) {
  return (
    <>
      <PageHeading
        title="Un espacio para reconectar"
      />
      {error ? <p role="alert">{error} Las actividades generales siguen disponibles.</p> : null}
      <RecommendationEntrySelector entries={entries} />
    </>
  );
}
