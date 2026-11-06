import Link from "next/link";
import { DueDateSlip } from "./DueDateSlip";
import { BorrowForm, LoanActions } from "@/app/works/[slug]/LoanDeskForms";
import { latestLoan, openLoan, PERIODS, slipFor } from "@/lib/loanDesk";
import type { DeskView } from "@/lib/loanStore";

// The circulation desk beside each work: borrow, see the slip, renew, return.
export function LoanDesk({ desk, slug, title, now }: { desk: DeskView; slug: string; title: string; now: number }) {
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
          <LoanActions slug={slug} loanId={open.id} canRenew={slip.canRenew} canReturn={slip.canReturn} />
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
