import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loanHistory } from "@/lib/ledger";
import { justBorrowed } from "@/lib/loanDesk";
import type { Loan } from "@/lib/engine/checkout";

const NOW = Date.parse("2026-11-07T10:00:00Z");
const H = 3600_000;
const loan = (id: string, borrowedAgoH: number, returnedAgoH: number | null): Loan => ({
  id, workId: "w-" + id, readerId: "me", period: "two_weeks", borrowedAt: NOW - borrowedAgoH * H, dueAt: NOW + 48 * H,
  returnedAt: returnedAgoH === null ? null : NOW - returnedAgoH * H, renewals: 0, bookmark: { chapterIndex: 0, wordOffset: 0 },
});

describe("ledger Borrowing history — just borrowed (C141)", () => {
  it("an open loan taken out within the hour counts; older or returned ones don't", () => {
    const rows = loanHistory([loan("fresh", 0.25, null), loan("old", 3, null), loan("back", 0.5, 0.1)], NOW);
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.fresh.open && justBorrowed(by.fresh, NOW)).toBe(true);
    expect(by.old.open && justBorrowed(by.old, NOW)).toBe(false);
    expect(by.back.open).toBe(false);
  });
  it("the row says 'just borrowed' in place of the stamp, which stays in the spoken label", () => {
    const src = readFileSync("app/ledger/page.tsx", "utf8");
    expect(src).toContain("{r.open && justBorrowed(r, now)");
    expect(src).toContain('<span aria-hidden="true" className="text-lamplight">just borrowed</span><span className="sr-only">Just borrowed, {stampDate(r.borrowedAt)}</span>');
    expect(src.indexOf("just borrowed</span>")).toBeLessThan(src.indexOf("C127: handed back within the hour"));
  });
});
