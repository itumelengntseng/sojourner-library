import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReaderView } from "@/components/ReaderView";
import { loadProof } from "@/lib/readingRoom";
import { myPace } from "@/lib/sessionStore";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Proof copy", robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// The Keeper reads any work as a reader would, without taking it out on loan.
export default async function Proof({ params, searchParams }: Props) {
  const { slug } = await params;
  const raw = (await searchParams).ch;
  const asked = Number.parseInt(Array.isArray(raw) ? raw[0] : raw ?? "", 10);
  const loaded = await loadProof(slug, Number.isFinite(asked) && asked > 0 ? asked : 1);
  if (!loaded.ok) {
    if (loaded.gate === "missing") notFound();
    return (
      <main id="main" className="mx-auto max-w-xl px-4 pt-24 text-center">
        <h1 className="text-2xl text-lamplight">Proof copies are for the Keeper</h1>
        <p className="mt-4 text-paper/90">To read this work, borrow it at the loan desk.</p>
        <Link href={`/works/${slug}`} className="mt-6 inline-block rounded bg-lamplight px-4 py-2 font-sans text-sm font-semibold text-ink hover:bg-ember">To the loan desk</Link>
      </main>
    );
  }
  const { wpm, minutesPerDay } = await myPace();
  return <ReaderView key={loaded.data.chapter.position} slug={slug} data={loaded.data} wpm={wpm} minutesPerDay={minutesPerDay} />;
}
