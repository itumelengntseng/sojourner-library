// The loan desk: pure helpers shared by the work page, the server actions and tests.
// Built on the checkout engine; the database enforces the same rules (0003_loan_desk.sql).
import {
  borrow,
  loanStatus,
  LOAN_PERIOD_MS,
  MAX_RENEWALS,
  renew,
  returnLoan,
  type Loan,
  type LoanPeriod,
  type LoanStatus,
} from "./engine/checkout";

export const PERIODS: { id: LoanPeriod; label: string; hint: string }[] = [
  { id: "hour", label: "An hour", hint: "a sitting" },
  { id: "evening", label: "An evening", hint: "four hours" },
  { id: "three_days", label: "Three days", hint: "a long weekend" },
  { id: "two_weeks", label: "Two weeks", hint: "the full loan" },
];

export function isLoanPeriod(v: unknown): v is LoanPeriod {
  return typeof v === "string" && v in LOAN_PERIOD_MS;
}

/** Decision: slips are stamped in South African time (the library's home). */
export const DESK_TIME_ZONE = "Africa/Johannesburg";

export function stampDate(ms: number): string {
  return new Date(ms).toLocaleString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: DESK_TIME_ZONE,
  });
}

/** "2 days 3 h", "45 min", "under a minute". */
export function timeLeft(ms: number): string {
  if (ms < 60_000) return "under a minute";
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return h > 0 ? `${days} day${days > 1 ? "s" : ""} ${h} h` : `${days} day${days > 1 ? "s" : ""}`;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

export interface Slip {
  status: LoanStatus;
  borrowed: string;
  due: string;
  returned: string | null;
  timeLeft: string | null;
  renewals: number;
  renewalsLeft: number;
  canRenew: boolean;
  canReturn: boolean;
  headline: string;
}

export function slipFor(loan: Loan, now: number): Slip {
  const status = loanStatus(loan, now);
  const open = status === "active" || status === "due_soon";
  const renewalsLeft = Math.max(0, MAX_RENEWALS - loan.renewals);
  const headline =
    status === "returned" ? "Back on the shelf" :
    status === "expired" ? "Loan ended — back on the shelf" :
    status === "due_soon" ? "Due back very soon" : "On loan to you";
  return {
    status,
    borrowed: stampDate(loan.borrowedAt),
    due: stampDate(loan.dueAt),
    returned: loan.returnedAt !== null ? stampDate(loan.returnedAt) : status === "expired" ? stampDate(loan.dueAt) : null,
    timeLeft: open ? timeLeft(loan.dueAt - now) : null,
    renewals: loan.renewals,
    renewalsLeft,
    canRenew: open && renewalsLeft > 0,
    canReturn: open,
    headline,
  };
}

/** Return-to-shelf on expiry: every expired loan is closed at its due time. */
export function settleExpired(loans: Loan[], now: number): Loan[] {
  return loans.map((l) => (loanStatus(l, now) === "expired" ? { ...l, returnedAt: l.dueAt } : l));
}

/** The reader's open loan of a work, if any (after settling). */
export function openLoan(loans: Loan[], workId: string, readerId: string, now: number): Loan | undefined {
  return loans.find((l) => l.workId === workId && l.readerId === readerId && l.returnedAt === null && loanStatus(l, now) !== "expired");
}

/** The most recent loan of a work, open or closed. */
export function latestLoan(loans: Loan[], workId: string, readerId: string): Loan | undefined {
  return loans
    .filter((l) => l.workId === workId && l.readerId === readerId)
    .sort((a, b) => b.borrowedAt - a.borrowedAt)[0];
}

// ── Desk operations on a list of loans (used by the preview desk) ───────────

export type DeskResult = { ok: true; loans: Loan[]; message: string } | { ok: false; loans: Loan[]; message: string };

const HISTORY_LIMIT = 20;

export function deskBorrow(loans: Loan[], a: { id: string; workId: string; readerId: string; period: LoanPeriod; now: number }): DeskResult {
  const settled = settleExpired(loans, a.now);
  try {
    const loan = borrow(a, settled);
    const next = [...settled, loan].sort((x, y) => y.borrowedAt - x.borrowedAt).slice(0, HISTORY_LIMIT);
    return { ok: true, loans: next, message: `Stamped. Due back ${stampDate(loan.dueAt)}.` };
  } catch (e) {
    return { ok: false, loans: settled, message: (e as Error).message };
  }
}

export function deskRenew(loans: Loan[], loanId: string, now: number): DeskResult {
  const settled = settleExpired(loans, now);
  const loan = settled.find((l) => l.id === loanId);
  if (!loan || loan.returnedAt !== null) {
    return { ok: false, loans: settled, message: "That loan has ended — the book is back on the shelf. Borrow it again." };
  }
  try {
    const renewed = renew(loan, now);
    return { ok: true, loans: settled.map((l) => (l.id === loanId ? renewed : l)), message: `Renewed. Now due back ${stampDate(renewed.dueAt)}.` };
  } catch (e) {
    return { ok: false, loans: settled, message: (e as Error).message };
  }
}

export function deskReturn(loans: Loan[], loanId: string, now: number): DeskResult {
  const settled = settleExpired(loans, now);
  const loan = settled.find((l) => l.id === loanId);
  if (!loan) return { ok: false, loans: settled, message: "The desk has no record of that loan." };
  return { ok: true, loans: settled.map((l) => (l.id === loanId ? returnLoan(l, now) : l)), message: "Returned to the shelf. Your bookmark is kept." };
}

// ── Preview desk storage (a cookie, used until Supabase is connected) ───────

export const PREVIEW_COOKIE = "soj_preview_loans";
export const PREVIEW_READER = "preview-reader";

function isLoan(x: unknown): x is Loan {
  if (!x || typeof x !== "object") return false;
  const l = x as Record<string, unknown>;
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  const bm = l.bookmark as Record<string, unknown> | undefined;
  return (
    typeof l.id === "string" && typeof l.workId === "string" && typeof l.readerId === "string" &&
    isLoanPeriod(l.period) && num(l.borrowedAt) && num(l.dueAt) && num(l.renewals) &&
    (l.returnedAt === null || num(l.returnedAt)) &&
    !!bm && num(bm.chapterIndex) && num(bm.wordOffset)
  );
}

/** Parses the cookie; anything malformed is dropped rather than trusted. */
export function parsePreviewLoans(raw: string | undefined): Loan[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(isLoan).slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

export function serializePreviewLoans(loans: Loan[]): string {
  return JSON.stringify(loans.slice(0, HISTORY_LIMIT));
}

// ── Database rows ───────────────────────────────────────────────────────────

export interface LoanRow {
  id: string; reader_id: string; work_id: string; period: LoanPeriod;
  borrowed_at: string; due_at: string; returned_at: string | null; renewals: number; bookmark_offset: number;
}

export function rowToLoan(r: LoanRow): Loan {
  return {
    id: r.id, workId: r.work_id, readerId: r.reader_id, period: r.period,
    borrowedAt: Date.parse(r.borrowed_at), dueAt: Date.parse(r.due_at),
    returnedAt: r.returned_at ? Date.parse(r.returned_at) : null,
    renewals: r.renewals, bookmark: { chapterIndex: 0, wordOffset: r.bookmark_offset },
  };
}
