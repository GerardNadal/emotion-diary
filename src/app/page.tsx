import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/modules/auth/session";
import { homeForRole } from "@/modules/auth/roles";
export const dynamic = "force-dynamic";
export default async function Home() {
  const profile = await getCurrentProfile();
  redirect(profile ? homeForRole(profile.role) : "/login");
}
