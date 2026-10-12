import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/modules/auth/session";
export const dynamic = "force-dynamic";
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  return (
    <AppShell profile={{ full_name: profile.full_name, role: profile.role }}>
      {children}
    </AppShell>
  );
}
