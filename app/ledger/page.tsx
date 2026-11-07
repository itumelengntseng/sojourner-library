import type { Metadata } from "next";
import Link from "next/link";
import { PreviewNotesExport } from "@/components/PreviewNotesExport";
import { ReadingByMonth } from "@/components/ReadingByMonth";
import { finishedBooks, finishedStamp, formatHours, historyPage } from "@/lib/ledger";
import { FinishedShelf } from "@/components/FinishedShelf";
import { loadLedger } from "@/lib/ledgerStore";
import { myContinueBySlug } from "@/lib/continueStore";
import { inline, myBookLeft } from "@/lib/bookLeftStore";
import { chapterLabel } from "@/lib/continueReading";
import { stampDate } from "@/lib/loanDesk";
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
  const [continueAt, bookLeft] = await Promise.all([myContinueBySlug(), myBookLeft()]);
  const link = (k: string) => (l.slugs[k] ? `/works/${l.slugs[k]}` : null);
  const tiles = [
    { label: "Current run", value: `${l.streaks.current} day${l.streaks.current === 1 ? "" : "s"}`, note: l.streaks.readToday ? "read today" : l.streaks.current ? "read today to keep it" : "start one today" },
    { label: "Longest run", value: `${l.streaks.longest} day${l.streaks.longest === 1 ? "" : "s"}` },
    { label: "Days read", value: String(l.streaks.days) },
    { label: "This week", value: l.week.ms > 0 ? formatHours(l.week.ms) : "0 min", note: l.week.days ? `on ${l.week.days} of the last 7 days` : "nothing in the last 7 days" },
    { label: "Time reading", value: formatHours(l.totalMs) },
    { label: "Words read", value: l.totalWords.toLocaleString("en-ZA").replace(/\s/g, "\u00a0"), note: "counted as you move past each paragraph" },
  ];

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 pt-16">
      <nav className="font-sans text-xs text-sandstone"><Link href="/" className="hover:text-lamplight">Front hall</Link> / Ledger</nav>
      <h1 className="mt-6 text-3xl text-lamplight sm:text-4xl">Your ledger</h1>
      <p className="mt-1 font-sans text-sm text-sandstone">{l.readerName ? `${l.readerName} · ` : ""}Private to you. The works of {AUTHOR}.</p>
      {l.mode === "preview" && <p className="mt-1 font-sans text-[0.7rem] text-sandstone/70">Preview ledger: kept in this browser until the library is connected.</p>}

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-sm border border-timber-dark bg-ink/40 p-4">
            <dt className="font-sans text-[0.65rem] uppercase tracking-wider text-sandstone">{t.label}</dt>
            <dd className="mt-1 text-2xl text-paper">{t.value}</dd>
            {t.note && <dd className="font-sans text-[0.65rem] text-sandstone/80">{t.note}</dd>}
          </div>
        ))}
      </dl>

      {l.totalMs > 0 && l.months.length > 0 && <ReadingByMonth months={l.months} />}

      <FinishedShelf items={finishedBooks(l.hours)} title={title} href={link} slug={(k) => l.slugs[k] ?? null} notes={l.mode === "preview" ? "preview" : "library"} />

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
                        {l.mode === "preview" ? <PreviewNotesExport slug={l.slugs[h.workKey]} title={title(h.workKey)} /> : (
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
                <span>{title(r.workKey)}</span>
                <span className="font-mono text-xs text-ochre">
                  {stampDate(r.borrowedAt)} → {r.open ? "on loan" : stampDate(r.endedAt!)}
                  {r.renewals > 0 ? ` · renewed ${r.renewals}×` : ""}
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
          {l.mode === "preview" ? <PreviewNotesExport /> : (
            <a href="/ledger/notes" className="inline-block rounded bg-lamplight px-4 py-2 font-sans text-sm font-semibold text-ink hover:bg-ember">Export my notes (Markdown)</a>
          )}
        </div>
      </section>
    </main>
  );
}
