import Link from "next/link";
import type { OnLoan } from "@/lib/loanDesk";

/** The reader's open loans at the front desk, each with its due-date stamp and a way back in. */
export function OnLoanNow({ loans }: { loans: OnLoan[] }) {
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
              <p className={`font-mono text-[0.7rem] uppercase tracking-wider ${l.dueSoon ? "text-ember" : "text-sandstone"}`}>
                Due {l.due} · {l.timeLeft} left
              </p>
            </div>
            <Link href={`/works/${l.slug}/read`} className="rounded bg-timber px-3 py-1.5 font-sans text-xs font-semibold text-paper hover:bg-ochre">
              {l.resume ? "Resume" : "Open"}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
