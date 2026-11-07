import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReaderView } from "@/components/ReaderView";
import { loadReading } from "@/lib/readingRoom";
import { myPace } from "@/lib/sessionStore";
import { myChaptersRead, myFinish, myFirstRead } from "@/lib/ledgerStore";
import { loadDesk } from "@/lib/loanStore";
import { justReturnedLoan } from "@/lib/loanDesk";

export const metadata: Metadata = { title: "Reading room" };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReadingRoom({ params, searchParams }: Props) {
  const { slug } = await params;
  const raw = (await searchParams).ch;
  const asked = Number.parseInt(Array.isArray(raw) ? raw[0] : raw ?? "", 10);
  const loaded = await loadReading(slug, Number.isFinite(asked) && asked > 0 ? asked : 0);

  if (!loaded.ok) {
    if (loaded.gate === "missing") notFound();
    // C135: handed back within the hour — say so, and that the bookmark waits.
    const desk = loaded.gate === "no-loan" ? await loadDesk(slug) : null;
    const backNow = desk && desk.mode !== "signed-out" && desk.mode !== "not-shelved" ? justReturnedLoan(desk.loans, desk.workId, desk.readerId, Date.now()) : undefined;
    return (
      <main id="main" className="mx-auto max-w-xl px-4 pt-24 text-center">
        <h1 className="text-2xl text-lamplight">The reading room is closed to you for now</h1>
        <p className="mt-4 text-paper/90">
          {loaded.gate === "signed-out"
            ? "Show your reader card at the front desk, then borrow the work."
            : backNow ? "You returned this just now — borrow it again to pick up at your bookmark."
            : "This work isn't on loan to you. Borrow it at the loan desk — your bookmark will be waiting."}
        </p>
        <Link href={loaded.gate === "signed-out" ? "/card" : `/works/${slug}`}
          className="mt-6 inline-block rounded bg-lamplight px-4 py-2 font-sans text-sm font-semibold text-ink hover:bg-ember">
          {loaded.gate === "signed-out" ? "To the front desk" : "To the loan desk"}
        </Link>
      </main>
    );
  }
  // Opening without a chapter number resumes at the bookmark.
  const data = loaded.data;
  const [{ wpm, minutesPerDay }, readPositions, finishedAt, firstRead] = await Promise.all([myPace(), myChaptersRead(slug), myFinish(slug), myFirstRead(slug)]);
  if (!(asked > 0) && data.bookmark && data.bookmark.position !== data.chapter.position) {
    const resumed = await loadReading(slug, data.bookmark.position);
    if (resumed.ok) return <ReaderView key={resumed.data.chapter.position} slug={slug} data={resumed.data} wpm={wpm} minutesPerDay={minutesPerDay} readPositions={readPositions} finishedAt={finishedAt} firstRead={firstRead} />;
  }
  return <ReaderView key={data.chapter.position} slug={slug} data={data} wpm={wpm} minutesPerDay={minutesPerDay} readPositions={readPositions} finishedAt={finishedAt} firstRead={firstRead} />;
}
