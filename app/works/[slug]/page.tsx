import { openLoan } from "@/lib/loanDesk";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AskLibrarian } from "@/components/AskLibrarian";
import { LoanDesk } from "@/components/LoanDesk";
import { SceneCover } from "@/components/SceneCover";
import { findWork } from "@/lib/catalogueServer";
import { formatDuration } from "@/lib/engine/readingTime";
import { librarianFacts } from "@/lib/librarian";
import { latestLoan } from "@/lib/loanDesk";
import { loadDesk } from "@/lib/loanStore";
import { outsideCanonNote } from "@/lib/canon";
import { myPace } from "@/lib/sessionStore";
import { myAnnotationCount, myChaptersRead, myFinish } from "@/lib/ledgerStore";
import { YourNotes } from "@/components/YourNotes";
import { myContinueReading } from "@/lib/continueStore";
import { ChapterMarks } from "@/components/ChapterMarks";
import { locateBookmark } from "@/lib/reader";
import { paceNote } from "@/lib/sessions";
import { CANON_LABEL, formatWords, workStats } from "@/lib/workStats";
import { finishedDate } from "@/lib/ledger";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const work = await findWork((await params).slug);
  return { title: work ? `${work.title} — ${work.author}` : "Not on the shelves" };
}

export default async function WorkPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const work = await findWork((await params).slug);
  if (!work) notFound();
  const [desk, pace, finished, readPositions, annotations, continueAt] = await Promise.all([loadDesk(work.slug), myPace(), myFinish(work.slug), myChaptersRead(work.slug), myAnnotationCount(work.slug), myContinueReading(work.slug)]);
  const stats = workStats(work, pace.wpm);
  const facts = librarianFacts({
    chapters: stats.chapters,
    bookmarkOffset: latestLoan(desk.loans, desk.workId, desk.readerId)?.bookmark.wordOffset ?? 0,
    wpm: pace.wpm,
    usualMinutesPerDay: pace.minutesPerDay,
  });
  const now = Date.now();
  const bookmarkWords = latestLoan(desk.loans, desk.workId, desk.readerId)?.bookmark.wordOffset ?? 0;
  const here = bookmarkWords > 0 ? locateBookmark(stats.chapters, bookmarkWords).position : null;
  const read = new Set(readPositions);
  // C54: with the book out, each chapter in Contents opens the reading room at that chapter.
  const out = desk.mode !== "signed-out" && desk.mode !== "not-shelved" && !!openLoan(desk.loans, desk.workId, desk.readerId, now);

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 pt-16">
      <nav className="font-sans text-xs text-sandstone">
        <Link href="/" className="hover:text-lamplight">Front hall</Link> / <Link href="/halls" className="hover:text-lamplight">Halls</Link> / {work.title}
      </nav>
      <div className="mt-8 grid gap-8 sm:grid-cols-[minmax(0,18rem)_1fr]">
        <SceneCover work={work} size="lg" />
        <div>
          <p className={`inline-block rounded-sm border px-2 py-0.5 font-sans text-[0.65rem] uppercase tracking-wider ${
            work.canonStatus === "canon" ? "border-lamplight/60 text-lamplight" : "border-ember/60 text-ember"}`}>
            {CANON_LABEL[work.canonStatus]}
          </p>
          <h1 className="mt-3 text-3xl text-lamplight sm:text-4xl">{work.title}</h1>
          <p className="mt-1 font-sans text-sm uppercase tracking-[0.2em] text-sandstone">by {work.author}</p>
          {finished !== undefined && (
            <p className="mt-3 inline-block -rotate-2 rounded-sm border border-lamplight/70 px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-lamplight">
              You finished this · {finishedDate(finished)}
            </p>
          )}
          {outsideCanonNote(work.canonStatus) && (
            <p className="mt-4 max-w-prose rounded-sm border border-ember/50 px-3 py-2 font-sans text-xs text-ember">{outsideCanonNote(work.canonStatus)}</p>
          )}
          <p className="mt-6 max-w-prose text-paper/90">{work.blurb}</p>

          <dl className="mt-6 grid max-w-sm grid-cols-2 gap-4 rounded-sm border border-timber-dark bg-ink/40 p-4">
            <div>
              <dt className="font-sans text-xs uppercase tracking-wider text-sandstone">Length</dt>
              <dd className="mt-1 text-lg">{formatWords(stats.words)}</dd>
            </div>
            <div>
              <dt className="font-sans text-xs uppercase tracking-wider text-sandstone">Reading time</dt>
              <dd className="mt-1 text-lg">{stats.readingTime}</dd>
              <dd className="font-sans text-[0.65rem] text-sandstone/80">{paceNote(pace)}</dd>
            </div>
          </dl>
          <YourNotes slug={work.slug} title={work.title} positions={work.chapters.map((c) => c.position)} counts={annotations} />
          {work.isPlaceholder && (
            <p className="mt-4 font-sans text-xs text-sandstone/80">Placeholder text — the manuscript has not arrived yet.</p>
          )}
        </div>
      </div>

      <section aria-labelledby="desk" className="mt-12 rounded-sm border border-timber-dark bg-stone-floor/60 p-5">
        <h2 id="desk" className="text-xl text-paper">The loan desk</h2>
        <div className="threshold my-3 opacity-60" aria-hidden="true" />
        {(await searchParams).returned === "1" && !openLoan(desk.loans, desk.workId, desk.readerId, now) && (
          <p role="status" className="mb-4 font-sans text-sm text-lamplight">Returned to the shelf. Your bookmark is kept — borrow it again any time.</p>
        )}
        <LoanDesk desk={desk} slug={work.slug} title={work.title} now={now} continueAt={continueAt} totalWords={facts.totalWords} wpm={pace.wpm} />
      </section>

      <div className="mt-8"><AskLibrarian facts={facts} title={work.title} /></div>

      <section aria-labelledby="contents" className="mt-12">
        <h2 id="contents" className="text-xl text-paper">Contents</h2>
        <ol className="mt-4 divide-y divide-timber-dark/70 border-y border-timber-dark/70">
          {stats.chapters.map((c) => (
            <li key={c.position} className="flex items-baseline justify-between gap-4 py-3">
              <span>{out
                ? <Link href={`/works/${work.slug}/read?ch=${c.position}`} className="underline-offset-4 hover:text-lamplight hover:underline">{c.title}<span className="sr-only"> — open in the reading room</span></Link>
                : c.title}<ChapterMarks read={read.has(c.position)} here={here === c.position} /></span>
              <span className="shrink-0 font-sans text-xs text-sandstone">{formatWords(c.words)} · {formatDuration(c.minutes)}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
