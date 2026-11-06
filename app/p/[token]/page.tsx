import type { Metadata } from "next";
import { PitchSheet } from "@/components/PitchSheet";
import { openSharedPitch } from "@/lib/pitchStore";

export const metadata: Metadata = { title: "A private pitch", robots: { index: false, follow: false }, referrer: "no-referrer" };

// What an agent or producer sees from a private link: the sheet, nothing else in the library.
export default async function SharedPitch({ params }: { params: Promise<{ token: string }> }) {
  const p = await openSharedPitch((await params).token);
  if (!p) {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 pt-24 text-center">
        <h1 className="text-2xl text-lamplight">This link has closed</h1>
        <p className="mt-4">Pitch links are private and expire. If you were expecting to read something here, ask the author for a fresh link.</p>
      </main>
    );
  }
  return <main id="main" className="px-4 pt-12"><PitchSheet kit={p.kit} work={p.work} /></main>;
}
