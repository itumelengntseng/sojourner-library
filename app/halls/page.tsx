import type { Metadata } from "next";
import Link from "next/link";
import { CanonToggle } from "@/components/CanonToggle";
import { hallsFor, seedOf } from "@/lib/catalogue";
import { loadCatalogue } from "@/lib/catalogueServer";
import { ShelfEmpty } from "@/components/ShelfEmpty";
import { canonView } from "@/lib/canonServer";
import { CANON_LABEL, filterByCanon, hallSummary, workStats } from "@/lib/workStats";
import { myPace } from "@/lib/sessionStore";
import { chapterHits, cleanQuery, resultLine, searchShelves } from "@/lib/shelfSearch";
import { parseSort, sortHref, sortShelf, SORTS } from "@/lib/shelfSort";
import { myOpenLoans, myRecentlyReturned } from "@/lib/loanStore";
import { dueBackSoon, justBorrowed, justReturned, loansBySlug, noRenewalsLeft } from "@/lib/loanDesk";
import { myFinishes } from "@/lib/ledgerStore";
import { myBookLeft } from "@/lib/bookLeftStore";
import { justBackLegend, spokenSpine } from "@/lib/spine";
import { FINISHED_SHELF, finishedStamp } from "@/lib/ledger";

export const metadata: Metadata = { title: "The halls" };

// Timber shelves; each book stands as a spine you can pull out.
export default async function Halls({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const view = await canonView(params.canon);
  const catalogue = await loadCatalogue();
  const query = cleanQuery(params.q);
  const halls = hallsFor(catalogue.works, catalogue.halls);
  const sort = parseSort(params.sort);
  const works = sortShelf(searchShelves(filterByCanon(catalogue.works, view), halls, query), sort);
  const canonParam = typeof params.canon === "string" ? params.canon : undefined;
  const [loansNow, pace, done, returnedNow] = await Promise.all([myOpenLoans(), myPace(), myFinishes(works.map((w) => w.slug)), myRecentlyReturned()]);
  // C132: books handed back within the hour (own returns only) carry a lamplight tick and say so.
  const nowMs = Date.now();
  const backNow: Record<string, string> = Object.fromEntries(returnedNow.filter((r) => justReturned(r, nowMs)).map((r) => [r.slug, r.returned]));
  const out = loansBySlug(loansNow);
  // C99: books due back within the day (the front hall slip's rule) get a "due soon" band.
  const soon = new Set(dueBackSoon(loansNow, Date.now()).map((l) => l.slug));
  const bookLeft = await myBookLeft(loansNow); // C79: spoken on the spines of books on loan

  return (
    <main id="main" className="mx-auto max-w-5xl px-4 pt-16">
      <nav className="font-sans text-xs text-sandstone"><Link href="/" className="hover:text-lamplight">Front hall</Link> / Halls</nav>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl text-lamplight sm:text-4xl">The halls</h1>
        <CanonToggle view={view} basePath="/halls" />
      </div>

      {catalogue.works.length === 0 && <ShelfEmpty catalogue={catalogue} />}
      {catalogue.works.length > 0 && (
        <form role="search" action="/halls" method="get" className="mt-6 flex max-w-md items-center gap-2 font-sans text-sm">
          <label htmlFor="shelf-q" className="sr-only">Search the shelves</label>
          <input
            id="shelf-q" name="q" type="search" defaultValue={query} maxLength={80} autoComplete="off"
            placeholder="Search titles, chapters, halls…"
            className="min-w-0 flex-1 rounded-sm border border-timber bg-stone-wall/70 px-3 py-2 text-paper placeholder:text-sandstone/70"
          />
          <button type="submit" className="rounded-sm border border-lamplight/60 px-3 py-2 text-lamplight hover:bg-lamplight/10">Search</button>
          {sort !== "shelf" && <input type="hidden" name="sort" value={sort} />}
          {query && <Link href={sortHref(sort, "", canonParam)} className="text-sandstone underline underline-offset-2 hover:text-lamplight">Clear</Link>}
        </form>
      )}
      {catalogue.works.length > 1 && (
        <nav aria-label="Order the shelves" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs text-sandstone">
          <span>Order:</span>
          {SORTS.map((o) => (
            <Link key={o.id} href={sortHref(o.id, query, canonParam)} aria-current={sort === o.id ? "true" : undefined}
              className={sort === o.id ? "text-lamplight underline underline-offset-4" : "hover:text-lamplight"}>{o.label}</Link>
          ))}
        </nav>
      )}
      {query && (
        <p role="status" className="mt-3 font-sans text-sm text-sandstone">
          {resultLine(works.length, query)}
          {/* C67: an empty result offers the way out — and drafts, when the canon switch is hiding a match. */}
          {works.length === 0 && view === "canon" && searchShelves(catalogue.works, halls, query).length > 0 && (
            <> A draft matches — <Link href={sortHref(sort, query, "all")} className="text-lamplight underline underline-offset-2">search the drafts too</Link>.</>
          )}
          {works.length === 0 && <> <Link href={sortHref(sort, "", canonParam)} className="text-lamplight underline underline-offset-2">Clear the search</Link>.</>}
        </p>
      )}
      {works.some((w) => out[w.slug]) && (
        <p className="mt-3 font-sans text-xs text-sandstone">
          <span aria-hidden="true" className="mr-1 rounded-[1px] bg-paper px-1 font-mono text-[0.55rem] font-semibold uppercase tracking-wider text-ink">out</span>
          {/* C118: how many are out. */}
          marks the {works.filter((w) => out[w.slug]).length === 1 ? "book" : `${works.filter((w) => out[w.slug]).length} books`} out to you — renew or return {works.filter((w) => out[w.slug]).length === 1 ? "it" : "them"} at the <Link href="/card" className="underline underline-offset-2 hover:text-lamplight">front desk</Link>.
        </p>
      )}
      {/* C103: the "due soon" band explained, only when one shows. */}
      {works.some((w) => out[w.slug] && soon.has(w.slug)) && (
        <p className="mt-1 font-sans text-xs text-sandstone">
          <span aria-hidden="true" className="mr-1 rounded-[1px] bg-ember px-1 font-mono text-[0.5rem] font-semibold uppercase tracking-wider text-ink">due soon</span>
          marks books due back within the day — renew them at the <Link href="/card" className="underline underline-offset-2 hover:text-lamplight">front desk</Link>.
        </p>
      )}
      {/* C142: the lamplight ✓ explained, only when one shows (books handed back within the hour). */}
      {works.some((w) => !out[w.slug] && backNow[w.slug]) && (
        <p className="mt-1 font-sans text-xs text-sandstone">
          <span aria-hidden="true" className="mr-1 font-mono text-[0.7rem] text-lamplight">✓</span>
          marks {justBackLegend(works.filter((w) => !out[w.slug] && backNow[w.slug]).length)}
        </p>
      )}
      {works.some((w) => done[w.slug] !== undefined) && (
        <p className="mt-1 font-sans text-xs text-sandstone">
          <span aria-hidden="true" className="mr-1 rounded-[1px] border border-lamplight px-1 font-mono text-[0.55rem] font-semibold uppercase tracking-wider text-lamplight">read</span>
          marks the books you have <Link href={FINISHED_SHELF} className="underline underline-offset-2 hover:text-lamplight">read to the end</Link>.
        </p>
      )}
      {halls.map((hall) => {
        const shelf = works.filter((w) => w.hall === hall.id);
        if (query && shelf.length === 0) return null;
        return (
          <section key={hall.id} aria-labelledby={`hall-${hall.id}`} className="mt-10">
            <h2 id={`hall-${hall.id}`} className="text-xl text-paper">{hall.name}</h2>
            {shelf.length > 0 && <p className="font-sans text-xs text-sandstone">{hallSummary(shelf, pace.wpm, pace.source !== "default")}</p>}
            {hall.note && <p className="font-sans text-xs text-sandstone/80">{hall.note}</p>}
            <div className="mt-4 rounded-sm bg-timber-dark/60 px-3 pt-6 shadow-inner">
              {shelf.length === 0 ? (
                <p className="pb-6 font-sans text-sm text-sandstone">This shelf is empty for now.</p>
              ) : (
                <ul className="flex items-end gap-2 overflow-x-auto pb-0">
                  {shelf.map((w) => {
                    const s = workStats(w, pace.wpm);
                    const height = 230 + Math.min(60, Math.round(s.words / 500));
                    const loan = out[w.slug];
                    return (
                      <li key={w.slug} className="shrink-0">
                        <Link
                          href={`/works/${w.slug}`}
                          style={{ height, filter: `hue-rotate(${seedOf(w.slug) / 8}deg)` }}
                          className="flex w-16 flex-col items-center justify-between rounded-t-sm border border-b-0 border-timber-dark bg-gradient-to-r from-timber via-[#7d5233] to-timber px-1 py-3 text-paper transition-transform hover:-translate-y-2 focus-visible:-translate-y-2"
                        >
                          {loan && <span aria-hidden="true" title={`On loan to you · due ${loan.due}`} className="-mt-1 mb-1 w-full rounded-[1px] bg-paper py-0.5 text-center font-mono text-[0.55rem] font-semibold uppercase tracking-wider text-ink">out</span>}
                          {loan && soon.has(w.slug) && <span aria-hidden="true" title="Due back within the day" className="-mt-0.5 mb-1 w-full rounded-[1px] bg-ember py-0.5 text-center font-mono text-[0.5rem] font-semibold uppercase leading-tight tracking-wider text-ink">due soon</span>}
                          {!loan && backNow[w.slug] && <span aria-hidden="true" title="Just returned" className="-mt-1 mb-1 font-mono text-[0.7rem] leading-none text-lamplight">✓</span>}
                          <span className="line-clamp-2 text-[0.75rem] leading-tight [writing-mode:vertical-rl] rotate-180">{w.title}</span>
                          <span className="font-sans text-[0.55rem] uppercase tracking-wider text-lamplight [writing-mode:vertical-rl] rotate-180">{w.author}</span>
                          {done[w.slug] !== undefined && <span aria-hidden="true" title={finishedStamp(done[w.slug])} className="mt-1 w-full rounded-[1px] border border-lamplight py-0.5 text-center font-mono text-[0.55rem] font-semibold uppercase tracking-wider text-lamplight">read</span>}
                          {w.canonStatus !== "canon" && <span aria-hidden="true" title="Not canon" className="mt-1 h-2 w-2 rounded-full bg-ember" />}
                          <span className="sr-only">
                            {spokenSpine({ author: w.author, canon: CANON_LABEL[w.canonStatus], readingTime: s.readingTime, due: loan?.due, dueSoon: soon.has(w.slug), noRenewals: loan ? noRenewalsLeft(loan) : false, bookLeft: bookLeft[w.slug], finished: done[w.slug], justReturned: backNow[w.slug], justBorrowed: loan && justBorrowed(loan, nowMs) ? loan.borrowed : undefined })}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="h-3 rounded-b-sm bg-timber" aria-hidden="true" />
            </div>
            {query && (() => {
              const hits = shelf.flatMap((w) => chapterHits(w, halls, query).map((c) => ({ w, c })));
              if (hits.length === 0) return null;
              return (
                <ul aria-label={`Chapter titles matching “${query}” in ${hall.name}`} className="mt-3 space-y-1 font-sans text-xs text-sandstone">
                  {hits.map(({ w, c }) => (
                    <li key={`${w.slug}-${c.position}`}>
                      <Link href={`/works/${w.slug}`} className="text-paper underline underline-offset-2 hover:text-lamplight">{w.title}</Link>
                      {" "}· chapter: {c.title}
                    </li>
                  ))}
                </ul>
              );
            })()}
          </section>
        );
      })}
    </main>
  );
}
