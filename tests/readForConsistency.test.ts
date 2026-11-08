import { describe, expect, it, vi } from "vitest";

// C178: every "read for" figure for one book comes from one source and shows the same time.
let cookieValue: string | undefined;
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookieValue === undefined ? undefined : { value: cookieValue }) }) }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => null }));

import { loadLedger, myHoursBySlug } from "@/lib/ledgerStore";
import { formatHours, readByWork, readForLine, spentLine } from "@/lib/ledger";
import { ask } from "@/lib/engine/ask";
import { librarianFacts, toReaderContext } from "@/lib/librarian";

describe("one figure for one book (C178)", () => {
  it("ledger Hours per book, history, card, work page, end card and librarian agree", async () => {
    const end = Date.now() - 60_000;
    cookieValue = JSON.stringify([
      { id: "a", slug: "placeholder-work-one", position: 1, wordsRead: 400, activeMs: 50 * 60_000, endedAt: end - 3_600_000 },
      { id: "b", slug: "placeholder-work-one", position: 2, wordsRead: 300, activeMs: 25 * 60_000 + 30_000, endedAt: end },
      { id: "c", slug: "placeholder-work-two", position: 1, wordsRead: 100, activeMs: 10 * 60_000, endedAt: end },
    ]);
    const l = await loadLedger();
    const key = Object.keys(l.slugs).find((k) => l.slugs[k] === "placeholder-work-one")!;
    expect(key).toBeTruthy();
    const row = l.hours.filter((h) => h.workKey === key);
    expect(row).toHaveLength(1); // one Hours per book row per work
    const ledgerFigure = formatHours(row[0].activeMs);
    expect(ledgerFigure).toBe("1 h 15 min");
    const bySlug = await myHoursBySlug();
    expect(formatHours(bySlug["placeholder-work-one"])).toBe(ledgerFigure); // card On loan now / Recently returned
    expect(formatHours(readByWork(l.hours)[key])).toBe(ledgerFigure); // Borrowing history
    expect(readForLine(bySlug["placeholder-work-one"])).toBe(`You've read for ${ledgerFigure} in this book`); // work page
    expect(spentLine(bySlug["placeholder-work-one"])).toBe(`You've spent ${ledgerFigure} reading this book`); // end card
    const facts = librarianFacts({ chapters: [{ position: 1, words: 1000 }], bookmarkOffset: 0, wpm: 230, usualMinutesPerDay: 30, readMs: bySlug["placeholder-work-one"] });
    expect(ask("How long have I read this book?", toReaderContext(facts, new Date())).text).toBe(`You've read for ${ledgerFigure} in this book so far.`);
    cookieValue = undefined;
  });
});
