import Link from "next/link";
import { justBorrowed, type OnLoan } from "@/lib/loanDesk";

/**
 * C143: by the front-hall door, when there is no book to continue and nothing just handed back —
 * a loan the reader took out within the hour and hasn't opened yet, with the way into the reading room.
 */
export function JustBorrowedNote({ loans, now }: { loans: OnLoan[]; now: number }) {
  const l = loans.filter((x) => !x.resume && justBorrowed(x, now)).sort((a, b) => (b.borrowedAt ?? 0) - (a.borrowedAt ?? 0))[0];
  if (!l) return null;
  return (
    <p className="mx-auto mt-8 max-w-md text-center font-sans text-xs text-sandstone">
      <span aria-hidden="true" className="text-lamplight">Just borrowed</span><span className="sr-only">Just borrowed, {l.borrowed}:</span>{" "}
      <span className="text-paper">{l.title}</span> ·{" "}
      <Link href={`/works/${l.slug}/read`} className="underline underline-offset-2 hover:text-lamplight">open it in the reading room<span className="sr-only">: {l.title}</span></Link>
    </p>
  );
}
