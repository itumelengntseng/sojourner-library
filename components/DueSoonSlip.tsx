import Link from "next/link";
import { noRenewalsLeft, type OnLoan } from "@/lib/loanDesk";

// A small slip tucked by the front-hall door: what's due back within the day.
// Each line offers Renew → the work page's loan desk (C101).
// `bookLeft` (slug → "About 25 min left in this book", C80) is added after the time left on the loan.
export function DueSoonSlip({ loans, bookLeft = {} }: { loans: OnLoan[]; bookLeft?: Record<string, string> }) {
  if (loans.length === 0) return null;
  return (
    <aside aria-labelledby="due-soon" className="mx-auto mt-8 max-w-md -rotate-1 rounded-sm bg-paper px-4 py-3 text-ink shadow-[0_10px_24px_-10px_rgb(0_0_0/0.7)]">
      <h2 id="due-soon" className="font-sans text-[0.65rem] uppercase tracking-[0.25em] text-[#8a4a12]">Due back soon</h2>
      <ul className="mt-1">
        {loans.map((l) => (
          <li key={l.workKey} className="flex flex-wrap items-baseline justify-between gap-x-3 py-0.5">
            <Link href={`/works/${l.slug}/read`} className="underline-offset-2 hover:underline">{l.title}</Link>
            <span className="flex items-baseline gap-2">
              <span className="font-mono text-xs text-[#8a4a12]">{l.due}{l.timeLeft ? ` · ${l.timeLeft} left` : ""}</span>
              {/* C101: each line offers the way to renew at the work's loan desk (as the card's C100);
                  C105: once every renewal is used, it says so instead. */}
              {noRenewalsLeft(l) ? (
                <span className="font-sans text-[0.7rem] font-semibold text-[#8a4a12]">no renewals left</span>
              ) : (
              <Link href={`/works/${l.slug}#desk`} className="font-sans text-[0.7rem] font-semibold text-[#8a4a12] underline underline-offset-2 hover:text-ink">
                Renew<span className="sr-only"> {l.title} at the loan desk</span>
              </Link>
              )}
            </span>
            {bookLeft[l.slug] && <span className="w-full font-sans text-[0.7rem] text-ink/75">{bookLeft[l.slug]}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-1 font-sans text-[0.7rem] text-ink/75">Renew or return at the <Link href="/card" className="underline underline-offset-2">front desk</Link>.</p>
    </aside>
  );
}
