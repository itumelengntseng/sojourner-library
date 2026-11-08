import Link from "next/link";
import { CanonToggle } from "@/components/CanonToggle";
import { SceneCover } from "@/components/SceneCover";
import { canonView } from "@/lib/canonServer";
import { filterByCanon, librarySummary } from "@/lib/workStats";
import { mostRead } from "@/lib/shelfSort";
import { myHoursBySlug } from "@/lib/ledgerStore";
import { loadCatalogue } from "@/lib/catalogueServer";
import { AUTHOR, SITE_NAME } from "@/lib/site";
import { ShelfEmpty } from "@/components/ShelfEmpty";
import { freshOnShelves } from "@/lib/catalogueRows";
import { DESK_TIME_ZONE, dueBackSoon, justReturned, splitDueSoon } from "@/lib/loanDesk";
import { myOpenLoans, myRecentlyReturned } from "@/lib/loanStore";
import { JustReturnedNote } from "@/components/JustReturnedNote";
import { JustBorrowedNote } from "@/components/JustBorrowedNote";
import { DueSoonSlip } from "@/components/DueSoonSlip";
import { myBookLeft } from "@/lib/bookLeftStore";
import { ContinueReading } from "@/components/ContinueReading";
import { FrontHallSearch } from "@/components/FrontHallSearch";
import { myPace } from "@/lib/sessionStore";
import { myContinueReading } from "@/lib/continueStore";

// The front hall: you step over the threshold and the covers are lit along the wall.
export default async function FrontHall({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = await canonView((await searchParams).canon);
  const catalogue = await loadCatalogue();
  const works = filterByCanon(catalogue.works, view);
  const now = Date.now();
  const fresh = freshOnShelves(works, now);
  const [open, cont, pace, readMs] = await Promise.all([myOpenLoans(), myContinueReading(), myPace(), myHoursBySlug()]);
  const top = mostRead(works, readMs);
  // C131: with nothing to continue, the book handed back within the hour (own returns only).
  const returned = cont ? [] : await myRecentlyReturned();
  const { onCard, onSlip } = splitDueSoon(dueBackSoon(open, now), cont?.slug);
  // C95 + C80: time left in the book for the Continue reading card and the due-soon slip (own loans only).
  const bookLeft = cont || onSlip.length ? await myBookLeft(open) : {};
  return (
    <main id="main" className="mx-auto max-w-5xl px-4 pt-16 sm:pt-24">
      <header className="flex flex-col items-center text-center">
        <p className="font-sans text-xs uppercase tracking-[0.3em] text-sandstone">Front hall</p>
        <h1 className="mt-4 text-4xl text-lamplight sm:text-5xl">{SITE_NAME}</h1>
        <p className="mt-3 text-paper/85">The writing of {AUTHOR}</p>
        <div className="threshold mt-8 w-48" aria-hidden="true" />
      </header>
      <ContinueReading card={cont} due={onCard} bookLeft={cont ? bookLeft[cont.slug] : undefined} />
      <DueSoonSlip loans={onSlip} bookLeft={bookLeft} />
      {!cont && <JustReturnedNote items={returned} now={now} />}
      {/* C143: nothing to continue, nothing just handed back — a book borrowed within the hour, not yet opened. */}
      {!cont && !returned.some((r) => justReturned(r, now)) && <JustBorrowedNote loans={open} now={now} />}

      <section aria-labelledby="on-the-wall" className="mt-12">
        <h2 id="on-the-wall" className="sr-only">On the wall</h2>
        <div className="mb-6 flex justify-center"><CanonToggle view={view} basePath="/" /></div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-8">
          {works.map((w) => (
            <li key={w.slug}>
              <Link href={`/works/${w.slug}`} className="block rounded-sm transition-transform hover:-translate-y-1">
                <SceneCover work={w} />
              </Link>
            </li>
          ))}
        </ul>
        {works.length > 0 && (
          <p className="mt-6 text-center font-sans text-xs text-sandstone">
            {librarySummary(works, pace.wpm, pace.source !== "default")}
            {/* C172: the reader's own most-read book, once they've read in two or more. */}
            {top && <> · most read: <Link href={`/works/${top.slug}`} className="underline underline-offset-2 hover:text-lamplight">{top.title}</Link></>}
          </p>
        )}
        {works.length === 0 && <ShelfEmpty catalogue={catalogue} />}
        {works.some((w) => w.isPlaceholder) && (
          <p className="mt-8 text-center font-sans text-xs text-sandstone/80">
            Works marked as placeholders hold their place until the manuscripts arrive.
          </p>
        )}
      </section>

      {fresh.length > 0 && (
        <section aria-labelledby="fresh" className="mx-auto mt-12 max-w-xl rounded-sm border border-timber-dark bg-ink/40 px-5 py-4">
          <h2 id="fresh" className="font-sans text-xs uppercase tracking-[0.25em] text-sandstone">Fresh on the shelves</h2>
          <ul className="mt-3 divide-y divide-timber-dark/60">
            {fresh.map((w) => (
              <li key={w.slug} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <Link href={`/works/${w.slug}`} className="text-paper hover:text-lamplight">{w.title} <span className="font-sans text-xs text-sandstone">by {w.author}</span></Link>
                <time dateTime={new Date(w.updatedAt!).toISOString()} className="rounded-sm border border-ember/50 px-1.5 font-mono text-[0.7rem] uppercase tracking-wider text-ember">
                  {new Date(w.updatedAt!).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: DESK_TIME_ZONE })}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}

      {works.length > 0 && <FrontHallSearch />}

      <div className="mt-12 flex flex-wrap justify-center gap-4">
        <Link href="/halls" className="rounded border border-sandstone/50 px-5 py-2 font-sans text-sm text-paper hover:border-lamplight">
          Walk the halls
        </Link>
        <Link href="/card" className="rounded border border-lamplight/60 px-5 py-2 font-sans text-sm text-lamplight hover:bg-lamplight hover:text-ink">
          Front desk
        </Link>
        <Link href="/ledger" className="rounded border border-sandstone/50 px-5 py-2 font-sans text-sm text-paper hover:border-lamplight">
          Your ledger
        </Link>
        <Link href="/lineage" className="rounded border border-sandstone/50 px-5 py-2 font-sans text-sm text-paper hover:border-lamplight">
          The family wall
        </Link>
        <Link href="/timeline" className="rounded border border-sandstone/50 px-5 py-2 font-sans text-sm text-paper hover:border-lamplight">
          Harlem timeline
        </Link>
      </div>
    </main>
  );
}
