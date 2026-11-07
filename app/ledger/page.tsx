import type { Metadata } from "next";
import Link from "next/link";
import { PreviewNotesExport } from "@/components/PreviewNotesExport";
import { ReadingByMonth } from "@/components/ReadingByMonth";
import { finishedBooks, finishedDuring, finishedStamp, formatHours, historyPage, renewalsLeftLine, type FinishInfo } from "@/lib/ledger";
import { FinishedShelf } from "@/components/FinishedShelf";
import { loadLedger } from "@/lib/ledgerStore";
import { myOpenLoans } from "@/lib/loanStore";
import { myContinueBySlug } from "@/lib/continueStore";
import { inline, myBookLeft } from "@/lib/bookLeftStore";
import { chapterLabel } from "@/lib/continueReading";
import { dueBackSoon, justReturned, stampDate } from "@/lib/loanDesk";
import { AUTHOR } from "@/lib/site";

export const metadata: Metadata = { title: "Your ledger" };

// A bound ledger on the librarian's desk: what you borrowed, how long you read, your run of days.
export default async function Ledger({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const showAll = (await searchParams).history === "all";
  const l = await loadLedger();
  if (l.mode === "signed-out") {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 pt-24 text-center">
        <h1 className="text-2xl text-lamplight">Your ledger</h1>
        <p className="mt-4">Show your reader card at the <Link href="/card" className="text-lamplight underline">front desk</Link> to open your ledger.</p>
      </main>
    );
  }
  const title = (k: string) => l.titles[k] ?? "A work no longer on the shelves";
  // C63: books out on loan now carry "Continue at <chapter>" in Hours per book.
  const open = await myOpenLoans();
  const [continueAt, bookLeft] = await Promise.all([myContinueBySlug(), myBookLeft(open)]);
  // C92: "Borrow again" on the Read to the end shelf for books still on the shelves and not on loan now.
  const onLoan = new Set(open.map((o) => o.slug));
  // C120: books due back within the day carry a "Due soon" mark in Hours per book (the card's C96 look).
  const dueSoonBy: Record<string, string> = Object.fromEntries(dueBackSoon(open, Date.now()).map((o) => [o.slug, o.due]));
  const borrowAgain = (k: string) => (l.slugs[k] && !onLoan.has(l.slugs[k]) ? `/works/${l.slugs[k]}` : null);
  const link = (k: string) => (l.slugs[k] ? `/works/${l.slugs[k]}` : null);
  const finished = finishedBooks(l.hours);
  const finishAt: Record<string, number | undefined> = Object.fromEntries(finished.map((f) => [f.workKey, f.finishedAt]));
  const now = Date.now();
  const backNow = l.history.find((r) => !r.open && link(r.workKey) && justReturned({ returnedAt: r.endedAt!, onTime: !!r.onTime }, now));
  // C94: preview downloads add the Finished line to finished books (library mode does it on the server).
  const finishMap: Record<string, FinishInfo> = Object.fromEntries(finished.flatMap((f) => (l.slugs[f.workKey] ? [[l.slugs[f.workKey], { at: f.finishedAt, firstRead: f.firstRead }]] : [])));
  const tiles: { label: string; value: string; note?: string; href?: string; spoken?: string; urgent?: boolean }[] = [
    { label: "Current run", value: `${l.streaks.current} day${l.streaks.current === 1 ? "" : "s"}`, note: l.streaks.readToday ? "read today" : l.streaks.current ? "read today to keep it" : "start one today" },
    { label: "Longest run", value: `${l.streaks.longest} day${l.streaks.longest === 1 ? "" : "s"}` },
    { label: "Days read", value: String(l.streaks.days) },
    { label: "This week", value: l.week.ms > 0 ? formatHours(l.week.ms) : "0 min", note: l.week.days ? `on ${l.week.days} of the last 7 days` : "nothing in the last 7 days" },
    { label: "Time reading", value: formatHours(l.totalMs) },
    { label: "Words read", value: l.totalWords.toLocaleString("en-ZA").replace(/\s/g, "\u00a0"), note: "counted as you move past each paragraph" },
    // C91: once a book is finished, a tile leading down to the Read to the end shelf.
    ...(finished.length ? [{ label: "Read to the end", value: `${finished.length} book${finished.length === 1 ? "" : "s"}`, note: "see the shelf", href: "#finished", spoken: ": the books you have read to the end" }] : []),
    // C113: what's out now (own loans, soonest due first), leading to the front desk.
    // C117: when the soonest is due back within the day (the front hall slip's rule), the note says so in ember.
    ...(open.length ? [{ label: "On loan", value: `${open.length} book${open.length === 1 ? "" : "s"}`, note: dueBackSoon(open, now).length ? `due back within the day · ${open[0].due}` : `next due ${open[0].due}`, href: "/card", spoken: " — renew or return at the front desk", urgent: dueBackSoon(open, now).length > 0 }] : []),
    // C134: nothing out, but a book handed back within the hour — the tile says so and leads back to it.
    ...(!open.length && backNow ? [{ label: "On loan", value: "Nothing out", note: `just returned · ${title(backNow.workKey)}`, href: link(backNow.workKey)!, spoken: " — borrow it again from its page" }] : []),
  ];

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 pt-16">
      <nav className="font-sans text-xs text-sandstone"><Link href="/" className="hover:text-lamplight">Front hall</Link> / Ledger</nav>
      <h1 className="mt-6 text-3xl text-lamplight sm:text-4xl">Your ledger</h1>
      <p className="mt-1 font-sans text-sm text-sandstone">{l.readerName ? `${l.readerName} · ` : ""}Private to you. The works of {AUTHOR}.</p>
      {l.mode === "preview" && <p className="mt-1 font-sans text-[0.7rem] text-sandstone/70">Preview ledger: kept in this browser until the library is connected.</p>}

      <dl className={`mt-8 grid grid-cols-2 gap-3 ${tiles.length > 6 ? "sm:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-6"}`}>
        {tiles.map((t) => (
          <div key={t.label} className="rounded-sm border border-timber-dark bg-ink/40 p-4">
            <dt className="font-sans text-[0.65rem] uppercase tracking-wider text-sandstone">{t.label}</dt>
            <dd className="mt-1 text-2xl text-paper">{t.value}</dd>
            {t.note && <dd className="font-sans text-[0.65rem] text-sandstone/80">{t.href ? <a href={t.href} className={`${t.urgent ? "text-ember" : "text-lamplight"} underline underline-offset-2`}>{t.note}{t.spoken && <span className="sr-only">{t.spoken}</span>}</a> : t.note}</dd>}
          </div>
        ))}
      </dl>

      {l.totalMs > 0 && l.months.length > 0 && <ReadingByMonth months={l.months} />}

      <FinishedShelf items={finished} title={title} href={link} slug={(k) => l.slugs[k] ?? null} notes={l.mode === "preview" ? "preview" : "library"} borrowAgain={borrowAgain} finishInfo={finishMap} />

      <section aria-labelledby="hours" className="mt-12">
        <h2 id="hours" className="text-xl text-paper">Hours per book</h2>
        {l.hours.length === 0 ? (
          <p className="mt-3 font-sans text-sm text-sandstone">No reading recorded yet. Time spent in the reading room is entered here.</p>
        ) : (
          <table className="mt-4 w-full border-collapse text-left">
            <thead className="font-sans text-[0.65rem] uppercase tracking-wider text-sandstone">
              <tr><th className="py-2 font-normal">Work</th><th className="py-2 font-normal">Time</th><th className="hidden py-2 font-normal sm:table-cell">Words</th><th className="py-2 text-right font-normal">Last read</th></tr>
            </thead>
            <tbody className="divide-y divide-timber-dark/70 border-y border-timber-dark/70">
              {l.hours.map((h) => (
                <tr key={h.workKey}>
                  <td className="py-3 pr-2">{link(h.workKey) ? <Link href={link(h.workKey)!} className="hover:text-lamplight">{title(h.workKey)}</Link> : title(h.workKey)}{h.finishedAt !== undefined && <span className="ml-2 inline-block -rotate-2 rounded-sm border border-lamplight/70 px-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-lamplight">{finishedStamp(h.finishedAt)}</span>}
                    {l.slugs[h.workKey] && dueSoonBy[l.slugs[h.workKey]] && (
                      <span className="ml-2 inline-block -rotate-2 rounded-sm border border-ember px-1.5 py-0.5 align-middle font-mono text-[0.65rem] uppercase tracking-wider text-ember">
                        Due soon<span className="sr-only">: back by {dueSoonBy[l.slugs[h.workKey]]}</span>
                      </span>
                    )}
                    {l.slugs[h.workKey] && continueAt[l.slugs[h.workKey]] && (() => {
                      const c = continueAt[l.slugs[h.workKey]];
                      return (
                        <p className="mt-0.5 font-sans text-xs text-paper/80">
                          Continue at <Link href={c.href} className="text-lamplight underline underline-offset-2">{chapterLabel(c)}<span className="sr-only"> of {title(h.workKey)}</span></Link>
                          <span className="text-sandstone"> · {c.left}</span>
                          {bookLeft[l.slugs[h.workKey]] && <span className="text-sandstone"> · {inline(bookLeft[l.slugs[h.workKey]])}</span>}
                        </p>
                      );
                    })()}
                    {l.slugs[h.workKey] && (
                      <div className="mt-0.5">
                        {l.mode === "preview" ? <PreviewNotesExport slug={l.slugs[h.workKey]} title={title(h.workKey)} finished={finishMap} /> : (
                          <a href={`/ledger/notes?work=${encodeURIComponent(l.slugs[h.workKey])}`} className="font-sans text-xs text-lamplight underline underline-offset-2">Notes for this book<span className="sr-only">: {title(h.workKey)}</span></a>
                        )}
                      </div>
                    )}</td>
                  <td className="py-3 pr-2 font-sans text-sm">{formatHours(h.activeMs)}</td>
                  <td className="hidden py-3 pr-2 font-sans text-sm sm:table-cell">{h.wordsRead.toLocaleString("en-ZA")}</td>
                  <td className="py-3 text-right font-mono text-xs text-ochre">{stampDate(h.lastRead)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="history" className="mt-12">
        <h2 id="history" className="text-xl text-paper">Borrowing history</h2>
        {l.history.length === 0 ? (
          <p className="mt-3 font-sans text-sm text-sandstone">Nothing borrowed yet. <Link href="/halls" className="text-lamplight underline">Visit the halls.</Link></p>
        ) : (
          <ol className="mt-4 divide-y divide-timber-dark/70 border-y border-timber-dark/70">
            {historyPage(l.history, showAll).rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <span>
                  {/* C98: the title leads to the work page while the work is still on the shelves. */}
                  {link(r.workKey) ? <Link href={link(r.workKey)!} className="hover:text-lamplight">{title(r.workKey)}</Link> : title(r.workKey)}
                  {/* C97: the loan during which the reader read the book to the end carries the Finished stamp. */}
                  {finishedDuring(r, finishAt[r.workKey], now) && (
                    <span className="ml-2 inline-block -rotate-2 rounded-sm border border-lamplight/70 px-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-lamplight">{finishedStamp(finishAt[r.workKey]!)}</span>
                  )}
                </span>
                <span className="font-mono text-xs text-ochre">
                  {stampDate(r.borrowedAt)} → {r.open ? "on loan" : justReturned({ returnedAt: r.endedAt!, onTime: !!r.onTime }, now)
                    // C127: handed back within the hour — "Just returned", the stamp kept for screen readers.
                    ? <><span aria-hidden="true" className="text-lamplight">Just returned</span><span className="sr-only">Just returned, {stampDate(r.endedAt!)}</span></>
                    : stampDate(r.endedAt!)}
                  {r.renewals > 0 ? ` · renewed ${r.renewals}×` : ""}
                  {/* C109: an open loan says how many renewals are left. */}
                  {r.open ? ` · ${renewalsLeftLine(r).toLowerCase()}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
        {historyPage(l.history, showAll).hidden > 0 && (
          <p className="mt-2 font-sans text-xs"><Link href="/ledger?history=all#history" className="text-lamplight underline underline-offset-2">Show all {l.history.length} loans</Link> <span className="text-sandstone">({historyPage(l.history, showAll).hidden} older)</span></p>
        )}
        {showAll && l.history.length > 10 && (
          <p className="mt-2 font-sans text-xs"><Link href="/ledger#history" className="text-lamplight underline underline-offset-2">Show the last 10</Link></p>
        )}
      </section>

      <section aria-labelledby="export" className="mt-12">
        <h2 id="export" className="text-xl text-paper">Your notes</h2>
        <p className="mt-2 font-sans text-sm text-sandstone">Take your margin notes and highlights with you as a Markdown file.</p>
        <div className="mt-4">
          {l.mode === "preview" ? <PreviewNotesExport finished={finishMap} /> : (
            <a href="/ledger/notes" className="inline-block rounded bg-lamplight px-4 py-2 font-sans text-sm font-semibold text-ink hover:bg-ember">Export my notes (Markdown)</a>
          )}
        </div>
      </section>
    </main>
  );
}
