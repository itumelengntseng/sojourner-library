import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DueDateSlip } from "@/components/DueDateSlip";
import { slipFor } from "@/lib/loanDesk";
import type { Loan } from "@/lib/engine/checkout";

const now = Date.parse("2026-11-07T10:00:00Z");
const loan = (dueIn: number, o: Partial<Loan> = {}): Loan => ({
  id: "l", workId: "w", readerId: "r", period: "hour", borrowedAt: now - 60_000, dueAt: now + dueIn,
  renewals: 0, returnedAt: null, bookmark: { chapterIndex: 0, wordOffset: 0 }, ...o,
});

describe("work page slip: due back within the hour (C107)", () => {
  it("marks the last hour of an open loan, but not the final 15 minutes (the headline says so) or later loans", () => {
    expect(slipFor(loan(59 * 60_000), now).withinHour).toBe(true);
    expect(slipFor(loan(3600_000), now).withinHour).toBe(true);
    expect(slipFor(loan(3600_001), now).withinHour).toBe(false);
    expect(slipFor(loan(10 * 60_000), now).withinHour).toBe(false);
    expect(slipFor(loan(30 * 60_000, { returnedAt: now - 1000 }), now).withinHour).toBe(false);
  });
  it("the slip carries the line only then", () => {
    expect(renderToStaticMarkup(<DueDateSlip slip={slipFor(loan(40 * 60_000), now)} title="Placeholder" />)).toContain("Due back within the hour");
    expect(renderToStaticMarkup(<DueDateSlip slip={slipFor(loan(3 * 3600_000), now)} title="Placeholder" />)).not.toContain("within the hour");
    const last = renderToStaticMarkup(<DueDateSlip slip={slipFor(loan(5 * 60_000), now)} title="Placeholder" />);
    expect(last).toContain("Due back very soon");
    expect(last).not.toContain("within the hour");
  });
});
