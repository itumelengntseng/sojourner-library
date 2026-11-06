import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PitchKitForm } from "@/components/PitchKitForm";
import { ownerPitch } from "@/lib/pitchStore";

export const metadata: Metadata = { title: "Edit pitch kit" };

export default async function EditPitch({ params }: { params: Promise<{ slug: string }> }) {
  const p = await ownerPitch((await params).slug);
  if (!p) notFound();
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 pt-16">
      <nav className="font-sans text-xs text-sandstone">
        <Link href="/writers-room" className="hover:text-lamplight">Writer&apos;s Room</Link> / <Link href="/pitch-room" className="hover:text-lamplight">Pitch Room</Link> / {p.work.title}
      </nav>
      <h1 className="mt-6 text-3xl text-lamplight">Pitch kit — {p.work.title}</h1>
      <p className="mt-1 font-sans text-sm text-sandstone">by {p.work.author} · <Link href={`/pitch-room/${p.kit.slug}`} className="text-lamplight underline underline-offset-2">See the sheet</Link></p>
      {!p.live && <p className="mt-4 rounded-sm border border-ember/50 px-3 py-2 font-sans text-xs text-ember">Preview: the library isn&apos;t connected yet, so kits can&apos;t be saved here. Until then they come from content/pitches.ts.</p>}
      {p.live && !p.stored && <p className="mt-4 font-sans text-xs text-sandstone">Not saved in the library yet — the fields start from the kit file (or empty).</p>}
      <div className="mt-8"><PitchKitForm kit={p.kit} canSave={p.live} /></div>
    </main>
  );
}
