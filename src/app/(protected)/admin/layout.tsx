import { requireProfile } from "@/modules/auth/session";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireProfile(["company_admin", "team_admin"]);
  return children;
}
