import { notFound } from "next/navigation";
import { getEntry } from "@/modules/journal/actions";
import { EmotionForm } from "@/modules/journal/emotion-form";
import { PageHeading } from "@/components/page-heading";
export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getEntry(id);
  if (!result.ok) throw new Error(result.message);
  if (!result.data) notFound();
  return <><PageHeading title="Editar entrada" /><EmotionForm key={id} entry={result.data} /></>;
}
