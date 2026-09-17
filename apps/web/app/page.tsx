import { Hero } from "@/front/features/marketing/hero";
import { WaitlistForm } from "@/front/features/waitlist/waitlist-form";

// Reads live Firestore data indirectly through the waitlist action; never
// attempt this at build time (Firestore isn't provisioned in every
// environment yet).
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-start justify-center gap-12 px-6 py-16 lg:flex-row lg:items-center lg:justify-between">
        <Hero />
        <WaitlistForm />
      </section>
    </main>
  );
}
