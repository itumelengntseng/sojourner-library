import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PitchSheet } from "@/components/PitchSheet";
import { ownerPitch } from "@/lib/pitchStore";

export const metadata: Metadata = { title: "Pitch sheet" };

export default async function PitchPreview({ params }: { params: Promise<{ slug: string }> }) {
  const p = await ownerPitch((await params).slug);
  if (!p) notFound();
  return (
    <main id="main" className="px-4 pt-12">
      <nav className="mx-auto max-w-2xl font-sans text-xs text-sandstone"><Link href="/pitch-room" className="hover:text-lamplight">← Pitch Room</Link> · This is how the sheet looks to someone holding a link. · <Link href={`/pitch-room/${p.kit.slug}/edit`} className="text-lamplight underline underline-offset-2">Edit the kit</Link></nav>
      <div className="mt-6"><PitchSheet kit={p.kit} work={p.work} /></div>
    </main>
  );
}
