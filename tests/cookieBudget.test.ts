import { describe, expect, it } from "vitest";
import { COMPACT_PREFIX, COOKIE_BUDGET, encodedLength, fitJson, readNum, unpackRecords } from "@/lib/cookieBudget";
import { parsePreviewLoans, serializePreviewLoans } from "@/lib/loanDesk";
import { parseStoredStats, serializeStoredStats, type StoredStats } from "@/lib/sessions";
import type { Loan } from "@/lib/engine/checkout";

const T = Date.parse("2026-11-06T10:00:00Z");
const loan = (i: number, open = false): Loan => ({
  id: crypto.randomUUID(), workId: "placeholder-work-three", readerId: "preview-reader", period: "evening",
  borrowedAt: T - i * 60_000, dueAt: T - i * 60_000 + 4 * 3600_000, renewals: 0,
  returnedAt: open ? null : T - i * 60_000 + 1000, bookmark: { chapterIndex: 0, wordOffset: 0 },
});

describe("preview cookies stay under the browser's limit (run 5 fix)", () => {
  it("fitJson drops what it's told until the JSON fits, and stops when nothing more may go", () => {
    const big = Array.from({ length: 100 }, (_, i) => ({ i, pad: "x".repeat(80) }));
    const out = JSON.parse(fitJson(big, (l) => (l.length ? l.length - 1 : -1), 1000));
    expect(encodedLength(JSON.stringify(out))).toBeLessThanOrEqual(1000);
    expect(out[0].i).toBe(0);
    expect(fitJson(big, () => -1, 10)).toBe(JSON.stringify(big)); // can't drop → unchanged
  });
  it("the loan desk cookie keeps open loans and the newest history, dropping the oldest returns", () => {
    // long work addresses force the budget even in the compact shape (C48)
    const loans = [loan(0, true), ...Array.from({ length: 19 }, (_, i) => loan(i + 1))].map((l) => ({ ...l, workId: "a-very-long-work-address-".repeat(8) + "x" }));
    const raw = serializePreviewLoans(loans);
    expect(encodedLength(raw)).toBeLessThanOrEqual(COOKIE_BUDGET);
    const back = parsePreviewLoans(raw);
    expect(back.some((l) => l.returnedAt === null)).toBe(true);
    expect(back.length).toBeGreaterThanOrEqual(8);
    expect(back.length).toBeLessThan(20);
    const kept = new Set(back.map((l) => l.id));
    // what's gone is the oldest
    const dropped = loans.filter((l) => !kept.has(l.id));
    expect(Math.max(...dropped.map((l) => l.borrowedAt))).toBeLessThan(Math.min(...back.filter((l) => l.returnedAt !== null).map((l) => l.borrowedAt)));
  });
  it("a short desk round-trips exactly", () => {
    const loans = [loan(0, true), loan(1)];
    expect(parsePreviewLoans(serializePreviewLoans(loans))).toEqual(loans);
  });
  it("the sessions cookie keeps the newest summaries under budget", () => {
    const stats: StoredStats[] = Array.from({ length: 40 }, (_, i) => ({ id: crypto.randomUUID(), slug: "placeholder-work-one", position: 1, wordsRead: 400, activeMs: 600_000, endedAt: T - i * 86_400_000 }));
    const raw = serializeStoredStats(stats);
    expect(encodedLength(raw)).toBeLessThanOrEqual(COOKIE_BUDGET);
    const back = parseStoredStats(raw);
    expect(back[0].endedAt).toBe(T);
    expect(back.length).toBeGreaterThanOrEqual(15);
  });
});

describe("C48 compact preview cookies", () => {
  const withBookmark = (l: Loan): Loan => ({ ...l, renewals: 2, bookmark: { chapterIndex: 3, wordOffset: 1234 } });

  it("the desk keeps 20 loans (its history limit) under budget again", () => {
    const loans = [loan(0, true), loan(1, true), ...Array.from({ length: 18 }, (_, i) => loan(i + 2))].map((l, i) => (i % 3 ? l : withBookmark(l)));
    const raw = serializePreviewLoans(loans);
    expect(raw.startsWith(COMPACT_PREFIX)).toBe(true);
    expect(encodedLength(raw)).toBe(raw.length); // nothing to URL-encode
    expect(encodedLength(raw)).toBeLessThanOrEqual(COOKIE_BUDGET);
    expect(parsePreviewLoans(raw)).toEqual(loans);
  });

  it("every period, renewals, a return and a bookmark round-trip; an unmoved bookmark is left off", () => {
    const periods = ["hour", "evening", "three_days", "two_weeks"] as const;
    const loans = periods.map((p, i) => ({ ...withBookmark(loan(i, i % 2 === 0)), period: p }));
    expect(parsePreviewLoans(serializePreviewLoans(loans))).toEqual(loans);
    const plain = serializePreviewLoans([loan(0, true)]);
    expect(unpackRecords(plain)![0]).toHaveLength(7);
  });

  it("still reads the older JSON cookie, and rewrites it in the compact shape", () => {
    const loans = [loan(0, true), withBookmark(loan(1))];
    const old = JSON.stringify(loans);
    expect(parsePreviewLoans(old)).toEqual(loans);
    expect(serializePreviewLoans(parsePreviewLoans(old)).startsWith(COMPACT_PREFIX)).toBe(true);
    const stats: StoredStats[] = [{ id: "a1", slug: "placeholder-work-one", position: 2, wordsRead: 300, activeMs: 60_000, endedAt: T }, { id: "a2", wordsRead: 10, activeMs: 5000, endedAt: T - 1 }];
    expect(parseStoredStats(JSON.stringify(stats))).toEqual(stats);
  });

  it("drops malformed compact records instead of trusting them", () => {
    const good = serializePreviewLoans([loan(0, true)]);
    const bad = [
      good + "!x~y",                                   // too few fields
      good + "!id~placeholder-work-one~z~1~2~~0",      // unknown period
      good + "!id~placeholder-work-one~e~-1~2~~0",     // negative time
      good + "!id~placeholder-work-one~e~1~2~@~0",     // bad return stamp
      good + "!~placeholder-work-one~e~1~2~~0",        // no id
      good + "!id~placeholder-work-one~e~1~2~~0~1",    // half a bookmark
    ];
    for (const raw of bad) expect(parsePreviewLoans(raw)).toHaveLength(1);
    expect(parsePreviewLoans("v2.")).toEqual([]);
    expect(parseStoredStats("v2.a~s~0~1~1~1")).toEqual([]); // chapter 0 isn't a chapter
    expect(parseStoredStats("v2.a~s~1~1.5~1~1")).toEqual([]);
  });

  it("sessions: 40 summaries (the preview limit) now fit, slug and chapter optional", () => {
    const stats: StoredStats[] = Array.from({ length: 40 }, (_, i) => ({ id: crypto.randomUUID(), slug: "placeholder-work-one", position: 1 + (i % 4), wordsRead: 400 + i, activeMs: 600_000 + i, endedAt: T - i * 86_400_000 }));
    stats.push({ id: crypto.randomUUID(), wordsRead: 5, activeMs: 1000, endedAt: T - 50 * 86_400_000 });
    const raw = serializeStoredStats(stats.slice(0, 40));
    expect(encodedLength(raw)).toBeLessThanOrEqual(COOKIE_BUDGET);
    expect(parseStoredStats(raw)).toEqual(stats.slice(0, 40));
    const noSlug = stats[40];
    expect(parseStoredStats(serializeStoredStats([noSlug]))).toEqual([noSlug]);
  });

  it("falls back to JSON when a value can't be written compactly", () => {
    const odd = { ...loan(0, true), workId: "has space" };
    const raw = serializePreviewLoans([odd]);
    expect(raw.startsWith("[")).toBe(true);
    expect(parsePreviewLoans(raw)).toEqual([odd]);
  });

  it("readNum only takes clean whole numbers", () => {
    expect(readNum("zz", 36)).toBe(1295);
    expect(readNum("12", 10)).toBe(12);
    for (const s of ["", "1e3", "-1", "1.5", "ZZ", undefined]) expect(readNum(s, 10)).toBeNull();
  });
});

describe("run 6 fix: an open loan is never trimmed from the preview history", () => {
  it("twenty newer borrows of another book keep the older open loan", async () => {
    const { deskBorrow, deskReturn, PREVIEW_READER } = await import("@/lib/loanDesk");
    const start = T;
    let loans: Loan[] = [{ ...loan(0, true), workId: "placeholder-work-two", borrowedAt: start, dueAt: start + 14 * 86_400_000, period: "two_weeks" }];
    for (let i = 1; i <= 24; i++) {
      const now = start + i * 60_000;
      const b = deskBorrow(loans, { id: crypto.randomUUID(), workId: "placeholder-work-one", readerId: PREVIEW_READER, period: "hour", now });
      const r = deskReturn(b.loans, b.loans.find((l) => l.workId === "placeholder-work-one" && l.returnedAt === null)!.id, now + 1000);
      loans = parsePreviewLoans(serializePreviewLoans(r.loans));
    }
    expect(loans.filter((l) => l.returnedAt === null).map((l) => l.workId)).toEqual(["placeholder-work-two"]);
    expect(loans.length).toBe(20);
  });
});
