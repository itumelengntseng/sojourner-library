import Link from "next/link";
import { formatDuration, minutesFor } from "@/lib/engine/readingTime";
import { ReturnFromRoom } from "./ReturnFromRoom";
import { finishedStamp } from "@/lib/ledger";

export interface ChapterLink { position: number; title: string; words: number }

/** What the card at the foot of a chapter shows. Uses only titles and word counts — no invented text. */
export function endOfChapter(chapters: ChapterLink[], position: number, wpm: number) {
  const sorted = [...chapters].sort((a, b) => a.position - b.position);
  const i = sorted.findIndex((c) => c.position === position);
  const next = i >= 0 ? sorted[i + 1] : undefined;
  if (!next) return { kind: "end" as const };
  return { kind: "next" as const, position: next.position, title: next.title, minutes: minutesFor(next.words, wpm) };
}

export function EndOfChapter({ slug, title, chapters, position, wpm, base, proof, loanId = "", finishedAt }: {
  slug: string; title: string; chapters: ChapterLink[]; position: number; wpm: number; base: string; proof: boolean; loanId?: string;
  /** C75: when the reader read this book to the end (own sessions); never shown in the proof copy. */
  finishedAt?: number;
}) {
  const end = endOfChapter(chapters, position, wpm);
  return (
    <section aria-label="End of the chapter" className="mt-10 rounded-sm border border-timber/60 bg-paper/5 px-4 py-5 text-center font-sans text-sm">
      {end.kind === "next" ? (
        <>
          <p className="text-xs uppercase tracking-[0.2em] opacity-80">Next chapter</p>
          <p className="mt-2 font-serif text-lg">{end.title}</p>
          <p className="mt-1 opacity-80">About {formatDuration(end.minutes)} at {wpm} wpm</p>
          <Link href={`${base}?ch=${end.position}`} className="mt-3 inline-block rounded bg-lamplight px-4 py-2 text-ink">
            Continue →
          </Link>
        </>
      ) : (
        <>
          <p className="text-xs uppercase tracking-[0.2em] opacity-80">The last page</p>
          <p className="mt-2 font-serif text-lg">The end of {title}</p>
          {!proof && finishedAt !== undefined && (
            <p className="mt-2">
              <time dateTime={new Date(finishedAt).toISOString()} className="inline-block -rotate-2 rounded-sm border border-current px-1.5 font-mono text-[0.7rem] uppercase tracking-wider">
                {finishedStamp(finishedAt)}
              </time>
            </p>
          )}
          {proof ? (
            <Link href="/writers-room" className="mt-3 inline-block rounded bg-lamplight px-4 py-2 text-ink">Back to the Writer&rsquo;s Room</Link>
          ) : (
            <Link href="/ledger" className="mt-3 inline-block rounded bg-lamplight px-4 py-2 text-ink">See it in your ledger</Link>
          )}
          <p className="mt-3"><Link href={`/works/${slug}`} className="underline">Back to the desk</Link></p>
          {!proof && loanId && <ReturnFromRoom slug={slug} loanId={loanId} title={title} />}
        </>
      )}
    </section>
  );
}
