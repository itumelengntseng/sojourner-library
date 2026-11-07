import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { justBorrowed } from "@/lib/loanDesk";

describe("work page: 'Just borrowed ·' on the On loan to you line (C140)", () => {
  const src = readFileSync("app/works/[slug]/page.tsx", "utf8");
  it("leads the line only for a loan taken out within the hour, spoken with its borrow stamp", () => {
    expect(src).toContain("{justBorrowed(openNow, now) && (");
    expect(src).toContain('<span className="sr-only">Just borrowed, {stampDate(openNow.borrowedAt)}</span>');
    expect(src.indexOf("Just borrowed</span>")).toBeLessThan(src.indexOf("On loan to you · due"));
  });
  it("uses the card's one-hour rule", () => {
    const now = Date.UTC(2026, 10, 7, 12);
    expect(justBorrowed({ borrowedAt: now - 59 * 60_000 }, now)).toBe(true);
    expect(justBorrowed({ borrowedAt: now - 60 * 60_000 }, now)).toBe(false);
    expect(justBorrowed({ borrowedAt: now + 60_000 }, now)).toBe(false);
  });
});
