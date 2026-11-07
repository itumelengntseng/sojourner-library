import Link from "next/link";
import { chapterLabel, type ContinueCard } from "@/lib/continueReading";
import { noRenewalsLeft, type OnLoan } from "@/lib/loanDesk";
import { AUTHOR } from "@/lib/site";

// One lamplit card by the front-hall door: the book you were last reading, and the way back in.
// C95: `bookLeft` ("About 25 min left in this book") follows the chapter's time left.
export function ContinueReading({ card, className = "mx-auto mt-8", due, bookLeft }: { card: ContinueCard | null; className?: string; due?: OnLoan; bookLeft?: string }) {
  if (!card) return null;
  return (
    <section aria-labelledby="continue-reading"
      className={`${className} max-w-md text-left rounded-sm border border-lamplight/40 bg-ink/60 px-5 py-4 shadow-[0_0_40px_-12px_rgb(242_197_124/0.45)]`}>
      <h2 id="continue-reading" className="font-sans text-xs uppercase tracking-[0.25em] text-sandstone">Continue reading</h2>
      <p className="mt-2 text-lg text-lamplight">{card.title}</p>
      <p className="font-sans text-xs text-sandstone">by {AUTHOR}</p>
      <p className="mt-2 text-paper/90">
        {chapterLabel(card)}
      </p>
      {due && (
        <p className="mt-2 font-mono text-[0.7rem] uppercase tracking-wider text-ember">
          Due back {due.due}{due.timeLeft ? ` · ${due.timeLeft} left` : ""} · {/* C114: once every renewal is used, only the return is left. */}
          {noRenewalsLeft(due) ? <>no renewals left · <Link href="/card" className="underline underline-offset-2">return</Link></> : <Link href="/card" className="underline underline-offset-2">renew or return</Link>}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[0.7rem] uppercase tracking-wider text-sandstone">{card.left}{bookLeft ? ` · ${bookLeft.charAt(0).toLowerCase()}${bookLeft.slice(1)}` : ""}</p>
        <Link href={card.href} className="rounded bg-lamplight px-4 py-1.5 font-sans text-sm font-semibold text-ink hover:bg-ember">
          Resume<span className="sr-only"> {card.title}</span>
        </Link>
      </div>
    </section>
  );
}
