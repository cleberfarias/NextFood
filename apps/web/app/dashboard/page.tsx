import { redirect } from "next/navigation";
import { signOutAction } from "@/back/actions/auth";
import { getDevPreviewUser } from "@/back/actions/dev-preview-user";
import { getCurrentUser } from "@/back/actions/get-current-user";
import { HomeHub } from "@/front/features/home/home-hub";

// Reads the session cookie, which depends on the Firebase Admin SDK being
// reachable (real project or emulator) -- never attempt at build time.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = (await getCurrentUser()) ?? getDevPreviewUser();
  if (!user) {
    redirect("/login");
  }

  return <HomeHub userLabel={user.email ?? user.uid} signOutAction={signOutAction} />;
}
