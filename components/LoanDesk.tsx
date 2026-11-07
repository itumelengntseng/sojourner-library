import Link from "next/link";
import { ContinueHere } from "./ContinueHere";
import { DueDateSlip } from "./DueDateSlip";
import type { ContinueCard } from "@/lib/continueReading";
import { BorrowForm, LoanActions } from "@/app/works/[slug]/LoanDeskForms";
import { bookLeftLine, latestLoan, openLoan, PERIODS, slipFor } from "@/lib/loanDesk";
import type { DeskView } from "@/lib/loanStore";

// The circulation desk beside each work: borrow, see the slip, renew, return.
// `totalWords` + `wpm` (C78) let the desk say how long is left in the book from the bookmark.
export function LoanDesk({ desk, slug, title, now, continueAt = null, totalWords = 0, wpm = 0 }: { desk: DeskView; slug: string; title: string; now: number; continueAt?: ContinueCard | null; totalWords?: number; wpm?: number }) {
  if (desk.mode === "signed-out") {
    return (
      <p className="font-sans text-sm text-sandstone">
        <Link href="/card" className="text-lamplight underline-offset-4 hover:underline">Show your reader card</Link> to borrow this work.
      </p>
    );
  }
  if (desk.mode === "not-shelved") {
    return <p className="font-sans text-sm text-sandstone">This work isn&apos;t on your shelves yet.</p>;
  }
  const open = openLoan(desk.loans, desk.workId, desk.readerId, now);
  const last = open ?? latestLoan(desk.loans, desk.workId, desk.readerId);
  const slip = last ? slipFor(last, now) : null;

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      {slip && <DueDateSlip slip={slip} title={title} />}
      <div className="flex flex-1 flex-col gap-3">
        {open && slip ? (
          <>
            <Link href={`/works/${slug}/read`}
              className="w-fit rounded bg-timber px-4 py-2 font-sans text-sm font-semibold text-paper hover:bg-ochre">
              {/* C149: a fresh loan starts; a bookmarked one resumes. */}
              {open.bookmark.wordOffset > 0 ? "Resume at your bookmark" : <>Start reading<span className="sr-only">: {title}</span></>}
            </Link>
            {open.bookmark.wordOffset > 0 && wpm > 0 && bookLeftLine(totalWords, open.bookmark.wordOffset, wpm) && (
              <p className="-mt-1 font-sans text-xs text-sandstone">{bookLeftLine(totalWords, open.bookmark.wordOffset, wpm)}</p>
            )}
            <ContinueHere card={continueAt?.slug === slug ? continueAt : null} />
            <LoanActions slug={slug} loanId={open.id} canRenew={slip.canRenew} canReturn={slip.canReturn} />
            {/* C110: why Renew is greyed out, and what to do instead. */}
            {slip.renewalsLeft === 0 && (
              <p className="-mt-1 font-sans text-xs text-sandstone">No renewals left — return it by {slip.due} and borrow it again; your bookmark is kept.</p>
            )}
          </>
        ) : (
          <BorrowForm slug={slug} periods={PERIODS} />
        )}
        {desk.mode === "preview" && (
          <p className="font-sans text-[0.7rem] text-sandstone/70">
            Preview desk: loans are kept in this browser only until the library is connected.
          </p>
        )}
      </div>
    </div>
  );
}
