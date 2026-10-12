import { PageHeading } from "@/components/page-heading";
import { EmotionForm } from "@/modules/journal/emotion-form";
import { emotions } from "@/modules/journal/emotions";
import { requireProfile } from "@/modules/auth/session";
export default async function NewEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ emotion?: string }>;
}) {
  await requireProfile();
  const { emotion } = await searchParams;
  const initialEmotion =
    emotions.find((item) => item.value === emotion)?.value ?? "";
  return (
    <>
      <PageHeading
        title="Dale espacio a lo que sientes"
        description="Escribe, elige, reflexiona. Este es tu momento."
      />
      <EmotionForm initialEmotion={initialEmotion} />
    </>
  );
}
