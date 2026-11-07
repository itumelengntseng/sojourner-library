import { formatDuration, minutesFor } from "./engine/readingTime";
// The loan desk: pure helpers shared by the work page, the server actions and tests.
// Built on the checkout engine; the database enforces the same rules (0003_loan_desk.sql).
import { b36, compactSafe, fitCookie, packRecords, readNum, unpackRecords } from "./cookieBudget";
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
  /** C107: open, and due back within the hour (C102's rule) — but not yet in the last 15 min, which the headline already says. */
  withinHour: boolean;
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
    withinHour: status === "active" && loan.dueAt - now <= 3600_000,
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

/**
 * Newest first, at most HISTORY_LIMIT — but a loan still out is never trimmed away
 * (found in run 6: twenty newer borrows of another book silently dropped an open loan).
 */
export function trimHistory(loans: Loan[]): Loan[] {
  const sorted = [...loans].sort((x, y) => y.borrowedAt - x.borrowedAt);
  const open = sorted.filter((l) => l.returnedAt === null).length;
  let room = Math.max(0, HISTORY_LIMIT - open);
  return sorted.filter((l) => l.returnedAt === null || room-- > 0);
}

export function deskBorrow(loans: Loan[], a: { id: string; workId: string; readerId: string; period: LoanPeriod; now: number }): DeskResult {
  const settled = settleExpired(loans, a.now);
  try {
    const loan = borrow(a, settled);
    const next = trimHistory([...settled, loan]);
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

// C48: the cookie's compact shape — id~work~period~borrowed~due~returned~renewals[~chapter~word]
// (times base 36; returned empty while out; the bookmark left off when it's at the start).
const PERIOD_CODE: Record<LoanPeriod, string> = { hour: "h", evening: "e", three_days: "d", two_weeks: "w" };
const CODE_PERIOD: Record<string, LoanPeriod> = { h: "hour", e: "evening", d: "three_days", w: "two_weeks" };

function loanRecord(l: Loan): string[] {
  const r = [l.id, l.workId, PERIOD_CODE[l.period], b36(l.borrowedAt), b36(l.dueAt), l.returnedAt === null ? "" : b36(l.returnedAt), String(l.renewals)];
  if (l.bookmark.chapterIndex !== 0 || l.bookmark.wordOffset !== 0) r.push(String(l.bookmark.chapterIndex), String(l.bookmark.wordOffset));
  return r;
}

function recordLoan(r: string[]): Loan | null {
  if (r.length !== 7 && r.length !== 9) return null;
  const [id, workId, code, b, d, ret, ren, ch, wo] = r;
  const period = CODE_PERIOD[code];
  const borrowedAt = readNum(b, 36), dueAt = readNum(d, 36), renewals = readNum(ren, 10);
  const returnedAt = ret === "" ? null : readNum(ret, 36);
  const chapterIndex = r.length === 9 ? readNum(ch, 10) : 0, wordOffset = r.length === 9 ? readNum(wo, 10) : 0;
  if (!id || !workId || !period || borrowedAt === null || dueAt === null || renewals === null || (ret !== "" && returnedAt === null) || chapterIndex === null || wordOffset === null) return null;
  return { id, workId, readerId: PREVIEW_READER, period, borrowedAt, dueAt, renewals, returnedAt, bookmark: { chapterIndex, wordOffset } };
}

/** Parses the cookie (compact shape, or the older JSON); anything malformed is dropped rather than trusted. */
export function parsePreviewLoans(raw: string | undefined): Loan[] {
  if (!raw) return [];
  const records = unpackRecords(raw);
  if (records) return trimHistory(records.map(recordLoan).filter((l): l is Loan => l !== null));
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? trimHistory(data.filter(isLoan)) : [];
  } catch {
    return [];
  }
}

/** The compact shape when every loan fits it (always, for the desk's own ids and slugs), else JSON. */
function writeLoans(loans: Loan[]): string {
  const records = loans.map(loanRecord);
  const compact = loans.every((l) => l.readerId === PREVIEW_READER && Number.isInteger(l.renewals) && l.renewals >= 0 &&
    Number.isInteger(l.bookmark.chapterIndex) && l.bookmark.chapterIndex >= 0 && Number.isInteger(l.bookmark.wordOffset) && l.bookmark.wordOffset >= 0) &&
    records.every((r) => compactSafe(r) && r[0] !== "" && r[1] !== "");
  return compact ? packRecords(records) : JSON.stringify(loans);
}

/** Keeps every open loan; when the cookie would pass its budget, the oldest ended loans go first. */
export function serializePreviewLoans(loans: Loan[]): string {
  return fitCookie(trimHistory(loans), writeLoans, (list) => {
    let oldest = -1;
    list.forEach((l, i) => { if (l.returnedAt !== null && (oldest < 0 || l.borrowedAt < list[oldest].borrowedAt)) oldest = i; });
    return oldest;
  });
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

// ── "On loan now" at the front desk ─────────────────────────────────────────

export interface OnLoan { workKey: string; slug: string; title: string; due: string; timeLeft: string; dueSoon: boolean; resume: boolean; dueAt: number; bookmark: number;
  /** C104: renewals still allowed on this loan (MAX_RENEWALS − used); missing = unknown, treated as renewable. */
  renewalsLeft?: number;
  /** C137: when it was borrowed (ms) and its stamp — for "Just borrowed". */
  borrowedAt?: number; borrowed?: string }

/** The reader's open loans, soonest due first. `works` maps a loan's workId to the work's slug and title. */
export function onLoanNow(loans: Loan[], readerId: string, works: Record<string, { slug: string; title: string }>, now: number): OnLoan[] {
  return settleExpired(loans, now)
    .filter((l) => l.readerId === readerId && l.returnedAt === null && works[l.workId])
    .sort((a, b) => a.dueAt - b.dueAt)
    .map((l) => {
      const s = slipFor(l, now);
      return { workKey: l.workId, slug: works[l.workId].slug, title: works[l.workId].title, due: s.due, timeLeft: s.timeLeft ?? "", dueSoon: s.status === "due_soon", resume: l.bookmark.wordOffset > 0, dueAt: l.dueAt, bookmark: l.bookmark.wordOffset, renewalsLeft: s.renewalsLeft, borrowedAt: l.borrowedAt, borrowed: stampDate(l.borrowedAt) };
    });
}

/** C104: true when the desk can't renew this loan any more. */
export function noRenewalsLeft(l: Pick<OnLoan, "renewalsLeft">): boolean {
  return l.renewalsLeft === 0;
}

/** The reader's open loans keyed by work slug — for marking the spines on the halls (C38). */
export function loansBySlug(loans: OnLoan[]): Record<string, OnLoan> {
  return Object.fromEntries(loans.map((l) => [l.slug, l]));
}

/** C42: if the "Continue reading" book is due soon, it carries its own stamp and leaves the slip. */
export function splitDueSoon(dueSoon: OnLoan[], continueSlug: string | undefined): { onCard: OnLoan | undefined; onSlip: OnLoan[] } {
  const onCard = continueSlug ? dueSoon.find((l) => l.slug === continueSlug) : undefined;
  return { onCard, onSlip: onCard ? dueSoon.filter((l) => l !== onCard) : dueSoon };
}

/** Loans due back within `windowMs` (default a day), soonest first — for the front-hall reminder. */
export function dueBackSoon(loans: OnLoan[], now: number, windowMs = 24 * 3600_000): OnLoan[] {
  return loans.filter((l) => l.dueAt > now && l.dueAt - now <= windowMs).sort((a, b) => a.dueAt - b.dueAt);
}

// ── "Recently returned" at the front desk ───────────────────────────────────

export interface Returned { workKey: string; slug: string; title: string; borrowed: string; returned: string; returnedAt: number; onTime: boolean }

/**
 * The reader's most recently returned works, newest return first — one line per work (its latest
 * return), leaving out works out on loan again right now. Loans that ran out count as returned at
 * their due time, exactly as the desk settles them. `works` maps workId → slug/title (set-aside works
 * are simply absent and so left out).
 */
export function recentlyReturned(loans: Loan[], readerId: string, works: Record<string, { slug: string; title: string }>, now: number, limit = 5): Returned[] {
  const settled = settleExpired(loans, now).filter((l) => l.readerId === readerId && works[l.workId]);
  const outNow = new Set(settled.filter((l) => l.returnedAt === null).map((l) => l.workId));
  const seen = new Set<string>();
  const out: Returned[] = [];
  for (const l of settled.filter((x) => x.returnedAt !== null).sort((a, b) => b.returnedAt! - a.returnedAt!)) {
    if (outNow.has(l.workId) || seen.has(l.workId)) continue;
    seen.add(l.workId);
    out.push({
      workKey: l.workId, slug: works[l.workId].slug, title: works[l.workId].title,
      borrowed: stampDate(l.borrowedAt), returned: stampDate(l.returnedAt!), returnedAt: l.returnedAt!, onTime: l.returnedAt! < l.dueAt,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** C124: a book the reader handed back within the last hour reads "Just returned" (expired loans settled by the desk don't). */
export function justReturned(r: Pick<Returned, "returnedAt" | "onTime">, now: number): boolean {
  return r.onTime && r.returnedAt <= now && now - r.returnedAt < 3600_000;
}

/** C129: the reader's latest loan of this work, if they handed it back within the hour (and it isn't out again). */
export function justReturnedLoan(loans: Loan[], workId: string, readerId: string, now: number): Loan | undefined {
  const l = latestLoan(loans, workId, readerId);
  if (!l || l.returnedAt === null) return undefined;
  return justReturned({ returnedAt: l.returnedAt, onTime: l.returnedAt < l.dueAt }, now) ? l : undefined;
}

/** C137: borrowed within the last hour. */
export function justBorrowed(l: Pick<OnLoan, "borrowedAt">, now: number): boolean {
  return l.borrowedAt !== undefined && l.borrowedAt <= now && now - l.borrowedAt < 3600_000;
}

// ── Time left in each book on loan (C74) ────────────────────────────────────

/** "About 1 h 2 min left in this book" from the bookmark at the reader's pace; "At the end of this book" when nothing's left. */
export function bookLeftLine(totalWords: number, bookmark: number, wpm: number): string | null {
  if (!(totalWords > 0)) return null;
  const left = Math.max(0, totalWords - Math.max(0, bookmark));
  if (left === 0) return "At the end of this book";
  return `About ${formatDuration(minutesFor(left, wpm))} left in this book`;
}
