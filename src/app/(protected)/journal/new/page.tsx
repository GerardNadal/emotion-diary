import { PageHeading } from "@/components/page-heading";
import { EmotionForm } from "@/modules/journal/emotion-form";
import { parseMood } from "@/modules/journal/emotions";
import { requireProfile } from "@/modules/auth/session";
export default async function NewEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ mood?: string | string[] }>;
}) {
  await requireProfile();
  const { mood } = await searchParams;
  const initialMood = parseMood(mood);
  return (
    <>
      <PageHeading
        title="Dale espacio a lo que sientes"
      />
      <EmotionForm key={initialMood} initialMood={initialMood} />
    </>
  );
}
