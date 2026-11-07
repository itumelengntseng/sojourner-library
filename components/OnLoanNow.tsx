import Link from "next/link";
import { chapterLabel, type ContinueCard } from "@/lib/continueReading";
import type { OnLoan } from "@/lib/loanDesk";

/** The reader's open loans at the front desk, each with its due-date stamp and a way back in. */
/** `bookLeft` (slug → "About 1 h 2 min left in this book", C74) is shown under each due line. */
/** `dueSoon` (slugs due back within the day — the front hall slip's rule, C96) get a small "Due soon" mark. */
export function OnLoanNow({ loans, continueAt = {}, bookLeft = {}, dueSoon = [] }: { loans: OnLoan[]; continueAt?: Record<string, ContinueCard>; bookLeft?: Record<string, string>; dueSoon?: string[] }) {
  if (loans.length === 0) {
    return (
      <p className="font-sans text-sm text-sandstone">
        Nothing out on loan. <Link href="/halls" className="text-lamplight underline underline-offset-2">Walk the halls</Link> to borrow a work.
      </p>
    );
  }
  return (
    <section aria-labelledby="on-loan" className="w-full max-w-md text-left">
      <h2 id="on-loan" className="font-sans text-xs uppercase tracking-[0.25em] text-sandstone">On loan now</h2>
      <ul className="mt-2 divide-y divide-timber-dark/60 rounded-sm border border-timber-dark bg-ink/40">
        {loans.map((l) => (
          <li key={l.workKey} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <Link href={`/works/${l.slug}`} className="text-paper hover:text-lamplight">{l.title}</Link>
              {dueSoon.includes(l.slug) && (
                <span className="ml-2 inline-block -rotate-2 rounded-sm border border-ember px-1.5 py-0.5 align-middle font-mono text-[0.65rem] uppercase tracking-wider text-ember">
                  Due soon<span className="sr-only">: back by {l.due}</span>
                </span>
              )}
              <p className={`font-mono text-[0.7rem] uppercase tracking-wider ${l.dueSoon ? "text-ember" : "text-sandstone"}`}>
                Due {l.due} · {l.timeLeft} left
              </p>
              {bookLeft[l.slug] && <p className="mt-0.5 font-sans text-xs text-sandstone">{bookLeft[l.slug]}</p>}
              {continueAt[l.slug] && (
                <p className="mt-1 font-sans text-xs text-paper/80">
                  Continue at{" "}
                  <Link href={continueAt[l.slug].href} className="text-lamplight underline underline-offset-2 hover:text-ember">{chapterLabel(continueAt[l.slug])}</Link>
                  <span className="text-sandstone"> · {continueAt[l.slug].left}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* C100: a loan due back within the day offers the way to renew it at the work's loan desk. */}
              {dueSoon.includes(l.slug) && (
                <Link href={`/works/${l.slug}#desk`} className="rounded border border-ember px-3 py-1.5 font-sans text-xs font-semibold text-ember hover:bg-ember hover:text-ink">
                  Renew<span className="sr-only"> {l.title} at the loan desk</span>
                </Link>
              )}
              <Link href={`/works/${l.slug}/read`} className="rounded bg-timber px-3 py-1.5 font-sans text-xs font-semibold text-paper hover:bg-ochre">
                {l.resume ? "Resume" : "Open"}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
