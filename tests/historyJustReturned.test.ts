import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loanHistory } from "@/lib/ledger";
import { justReturned } from "@/lib/loanDesk";
import type { Loan } from "@/lib/engine/checkout";

const NOW = Date.parse("2026-11-07T10:00:00Z");
const H = 3600_000;
const loan = (id: string, returnedAgoH: number | null, dueInH: number): Loan => ({
  id, workId: "w", readerId: "me", period: "two_weeks", borrowedAt: NOW - 30 * H, dueAt: NOW + dueInH * H,
  returnedAt: returnedAgoH === null ? null : NOW - returnedAgoH * H, renewals: 0, bookmark: { chapterIndex: 0, wordOffset: 0 },
});

describe("ledger Borrowing history — Just returned (C127)", () => {
  it("marks rows the reader handed back, not ones the desk settled", () => {
    const rows = loanHistory([loan("back", 0.5, 10), loan("ran-out", null, -0.5), loan("open", null, 5)], NOW);
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.back.onTime).toBe(true);
    expect(by["ran-out"].onTime).toBe(false);
    expect(by.open.onTime).toBe(false);
    expect(justReturned({ returnedAt: by.back.endedAt!, onTime: !!by.back.onTime }, NOW)).toBe(true);
    expect(justReturned({ returnedAt: by["ran-out"].endedAt!, onTime: !!by["ran-out"].onTime }, NOW)).toBe(false);
  });
  it("after the hour the row keeps its stamp", () => {
    const [r] = loanHistory([loan("old", 2, 10)], NOW);
    expect(justReturned({ returnedAt: r.endedAt!, onTime: !!r.onTime }, NOW)).toBe(false);
  });
  it("the ledger shows 'Just returned' with the stamp in the spoken label", () => {
    const src = readFileSync("app/ledger/page.tsx", "utf8");
    expect(src).toMatch(/justReturned\(\{ returnedAt: r\.endedAt!, onTime: !!r\.onTime \}, now\)/);
    expect(src).toMatch(/<span aria-hidden="true" className="text-lamplight">Just returned<\/span><span className="sr-only">Just returned, \{stampDate\(r\.endedAt!\)\}<\/span>/);
  });
});

describe("ledger On loan tile — just returned (C134)", () => {
  it("with nothing out, the tile names the book handed back within the hour and links to its page", () => {
    const src = readFileSync("app/ledger/page.tsx", "utf8");
    expect(src).toContain("const backNow = l.history.find((r) => !r.open && link(r.workKey) && justReturned({ returnedAt: r.endedAt!, onTime: !!r.onTime }, now));");
    expect(src).toContain('...(!open.length && backNow ? [{ label: "On loan", value: "Nothing out", note: `just returned · ${title(backNow.workKey)}`, href: link(backNow.workKey)!');
  });
});
