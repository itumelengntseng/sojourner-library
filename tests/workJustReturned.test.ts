import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { justReturnedLoan } from "@/lib/loanDesk";
import type { Loan } from "@/lib/engine/checkout";

const NOW = Date.parse("2026-11-07T10:00:00Z");
const M = 60_000;
const loan = (id: string, borrowedAgoMin: number, returnedAgoMin: number | null, dueInMin = 600, readerId = "me", workId = "w"): Loan => ({
  id, workId, readerId, period: "two_weeks", borrowedAt: NOW - borrowedAgoMin * M, dueAt: NOW + dueInMin * M,
  returnedAt: returnedAgoMin === null ? null : NOW - returnedAgoMin * M, renewals: 0, bookmark: { chapterIndex: 0, wordOffset: 0 },
});

describe("work page — Just returned (C129)", () => {
  it("finds the reader's own latest loan handed back within the hour", () => {
    expect(justReturnedLoan([loan("a", 90, 20)], "w", "me", NOW)?.id).toBe("a");
    expect(justReturnedLoan([loan("a", 90, 61)], "w", "me", NOW)).toBeUndefined();
    expect(justReturnedLoan([loan("a", 90, 20, 600, "someone")], "w", "me", NOW)).toBeUndefined();
    expect(justReturnedLoan([loan("a", 90, 20, 600, "me", "other")], "w", "me", NOW)).toBeUndefined();
  });
  it("not when it's out again or the loan simply ran out", () => {
    expect(justReturnedLoan([loan("a", 90, 20), loan("b", 5, null)], "w", "me", NOW)).toBeUndefined();
    expect(justReturnedLoan([loan("a", 90, 20, -20)], "w", "me", NOW)).toBeUndefined(); // settled at its due time
  });
  it("the work page shows it under the title, linking to the desk, the stamp in its spoken label", () => {
    const src = readFileSync("app/works/[slug]/page.tsx", "utf8");
    expect(src).toMatch(/const backNow = !openNow && .*justReturnedLoan\(desk\.loans, desk\.workId, desk\.readerId, now\)/);
    expect(src).toContain('<Link href="#desk" className="underline underline-offset-2 hover:text-lamplight"><span aria-hidden="true">Just returned</span><span className="sr-only">Just returned, {stampDate(backNow.returnedAt!)}</span> · borrow it again below</Link>');
    expect(src.indexOf("borrow it again below")).toBeLessThan(src.indexOf('<h2 id="desk"'));
  });
});
