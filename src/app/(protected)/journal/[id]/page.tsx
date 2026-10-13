import { notFound } from "next/navigation";
import { getEntry } from "@/modules/journal/actions";
import { EntryDetails } from "@/modules/journal/entry-details";
export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getEntry(id);
  if (!result.ok) throw new Error(result.message);
  if (!result.data) notFound();
  return <EntryDetails entry={result.data} />;
}
