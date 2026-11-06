import { describe, expect, it } from "vitest";
import { COOKIE_BUDGET, encodedLength, fitJson } from "@/lib/cookieBudget";
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
    const loans = [loan(0, true), ...Array.from({ length: 19 }, (_, i) => loan(i + 1))];
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
  it("a short desk is written unchanged", () => {
    const loans = [loan(0, true), loan(1)];
    expect(serializePreviewLoans(loans)).toBe(JSON.stringify(loans));
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
