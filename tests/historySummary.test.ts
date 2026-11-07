import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { historySummary } from "@/lib/ledger";

const NOW = Date.parse("2026-11-07T10:00:00Z");
const D = 86_400_000;

describe("ledger Borrowing history — last 30 days (C152)", () => {
  it("counts loans taken out in the last 30 days and the ones handed back before they were due", () => {
    expect(historySummary([
      { borrowedAt: NOW - 1 * D, open: true, onTime: false },
      { borrowedAt: NOW - 5 * D, open: false, onTime: true },
      { borrowedAt: NOW - 20 * D, open: false, onTime: false },
      { borrowedAt: NOW - 40 * D, open: false, onTime: true },
    ], NOW)).toBe("3 loans in the last 30 days · 1 handed back before it was due");
    expect(historySummary([{ borrowedAt: NOW - D, open: false, onTime: true }, { borrowedAt: NOW - 2 * D, open: false, onTime: true }], NOW))
      .toBe("2 loans in the last 30 days · 2 handed back before they were due");
    expect(historySummary([{ borrowedAt: NOW - D, open: true }], NOW)).toBe("1 loan in the last 30 days");
  });
  it("says nothing with no loans in 30 days", () => {
    expect(historySummary([{ borrowedAt: NOW - 31 * D, open: false, onTime: true }], NOW)).toBeNull();
    expect(historySummary([], NOW)).toBeNull();
  });
  it("sits above the list", () => {
    const src = readFileSync("app/ledger/page.tsx", "utf8");
    expect(src).toContain("{historySummary(l.history, now) && <p className=\"mt-2 font-sans text-xs text-sandstone\">{historySummary(l.history, now)}</p>}");
    expect(src.indexOf("historySummary(l.history, now) &&")).toBeLessThan(src.indexOf("historyPage(l.history, showAll).rows.map"));
  });
});
