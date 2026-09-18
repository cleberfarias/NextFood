import { redirect } from "next/navigation";
import { getCurrentUser } from "@/back/actions/get-current-user";
import { LoginExperience } from "@/front/features/auth/login-experience";

// Reads the session cookie via the Firebase Admin SDK -- never attempt at
// build time (not every environment has it configured yet).
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return <LoginExperience />;
}
