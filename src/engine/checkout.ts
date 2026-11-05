// Checkout (borrowing) logic. A loan is a time-boxed right to read a work.
// When it expires the book "returns to the shelf"; the bookmark always survives.

export type LoanPeriod = "hour" | "evening" | "three_days" | "two_weeks";

export const LOAN_PERIOD_MS: Record<LoanPeriod, number> = {
  hour: 60 * 60 * 1000,
  evening: 4 * 60 * 60 * 1000,
  three_days: 3 * 24 * 60 * 60 * 1000,
  two_weeks: 14 * 24 * 60 * 60 * 1000,
};

export const MAX_RENEWALS = 3;

export interface Bookmark {
  chapterIndex: number;
  wordOffset: number; // words read so far in the whole work
}

export interface Loan {
  id: string;
  workId: string;
  readerId: string;
  period: LoanPeriod;
  borrowedAt: number;
  dueAt: number;
  renewals: number;
  returnedAt: number | null;
  bookmark: Bookmark;
}

export type LoanStatus = "active" | "due_soon" | "expired" | "returned";

const DUE_SOON_MS = 15 * 60 * 1000;

export function borrow(
  args: { id: string; workId: string; readerId: string; period: LoanPeriod; now: number; bookmark?: Bookmark },
  existingLoans: Loan[],
): Loan {
  const open = existingLoans.find(
    (l) => l.workId === args.workId && l.readerId === args.readerId && loanStatus(l, args.now) !== "returned" && loanStatus(l, args.now) !== "expired",
  );
  if (open) throw new Error("This work is already on loan to you — renew it instead.");

  // Carry the bookmark forward from the most recent previous loan of this work.
  const previous = existingLoans
    .filter((l) => l.workId === args.workId && l.readerId === args.readerId)
    .sort((a, b) => b.borrowedAt - a.borrowedAt)[0];

  return {
    id: args.id,
    workId: args.workId,
    readerId: args.readerId,
    period: args.period,
    borrowedAt: args.now,
    dueAt: args.now + LOAN_PERIOD_MS[args.period],
    renewals: 0,
    returnedAt: null,
    bookmark: args.bookmark ?? previous?.bookmark ?? { chapterIndex: 0, wordOffset: 0 },
  };
}

export function loanStatus(loan: Loan, now: number): LoanStatus {
  if (loan.returnedAt !== null) return "returned";
  if (now >= loan.dueAt) return "expired";
  if (loan.dueAt - now <= DUE_SOON_MS) return "due_soon";
  return "active";
}

/** Renewing extends from the later of now or the current due date. */
export function renew(loan: Loan, now: number): Loan {
  const status = loanStatus(loan, now);
  if (status === "returned") throw new Error("This work has been returned — borrow it again.");
  if (loan.renewals >= MAX_RENEWALS) throw new Error(`Renewal limit reached (${MAX_RENEWALS}).`);
  const base = Math.max(now, loan.dueAt);
  return { ...loan, dueAt: base + LOAN_PERIOD_MS[loan.period], renewals: loan.renewals + 1 };
}

export function returnLoan(loan: Loan, now: number): Loan {
  if (loan.returnedAt !== null) return loan;
  return { ...loan, returnedAt: Math.min(now, loan.dueAt) };
}

export function updateBookmark(loan: Loan, bookmark: Bookmark, now: number): Loan {
  if (loanStatus(loan, now) === "returned") throw new Error("Cannot move a bookmark on a returned loan.");
  // Reading is blocked once expired, but saving the last position is still allowed.
  return { ...loan, bookmark };
}

export function canRead(loan: Loan, now: number): boolean {
  const s = loanStatus(loan, now);
  return s === "active" || s === "due_soon";
}
