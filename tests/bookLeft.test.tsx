import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// C74: "About N min left in this book" on the card's On loan now.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => null }));

import { bookLeftLine, onLoanNow, type OnLoan } from "@/lib/loanDesk";
import { myLoanWords } from "@/lib/loanStore";
import { OnLoanNow } from "@/components/OnLoanNow";
import { getWork } from "@/lib/catalogue";
import { countWords } from "@/lib/engine/readingTime";
import type { Loan } from "@/lib/engine/checkout";

const NOW = Date.parse("2026-11-06T10:00:00Z");
const on = (slug: string, bookmark: number): OnLoan => ({ workKey: slug, slug, title: `Placeholder ${slug}`, due: "Fri 6 Nov, 14:00", timeLeft: "4 h", dueSoon: false, resume: bookmark > 0, dueAt: NOW + 3600_000, bookmark });

describe("time left in each book on loan (C74)", () => {
  it("words the line from the bookmark at the reader's pace", () => {
    expect(bookLeftLine(9200, 3450, 230)).toBe("About 25 min left in this book");
    expect(bookLeftLine(9200, 0, 230)).toBe("About 40 min left in this book");
    expect(bookLeftLine(9200, 9200, 230)).toBe("At the end of this book");
    expect(bookLeftLine(9200, 99_999, 230)).toBe("At the end of this book");
    expect(bookLeftLine(0, 0, 230)).toBeNull();
  });
  it("carries the bookmark on each open loan", () => {
    const loan: Loan = { id: "1", workId: "w", readerId: "me", period: "two_weeks", borrowedAt: NOW - 1000, dueAt: NOW + 3600_000, returnedAt: null, renewals: 0, bookmark: { chapterIndex: 0, wordOffset: 120 } };
    expect(onLoanNow([loan], "me", { w: { slug: "s", title: "T" } }, NOW)[0].bookmark).toBe(120);
  });
  it("counts the whole book's words for each work on loan (preview)", async () => {
    const w = getWork("placeholder-work-two")!;
    const total = w.chapters.reduce((n, c) => n + countWords(c.body), 0);
    expect(await myLoanWords([on("placeholder-work-two", 0)])).toEqual({ "placeholder-work-two": total });
    expect(await myLoanWords([])).toEqual({});
  });
  it("shows the line under the due stamp only when given", () => {
    const html = renderToStaticMarkup(<OnLoanNow loans={[on("a", 10), on("b", 0)]} bookLeft={{ a: "About 25 min left in this book" }} />);
    expect(html.match(/left in this book/g)).toHaveLength(1);
    expect(html.indexOf("About 25 min left in this book")).toBeGreaterThan(html.indexOf("Due Fri 6 Nov"));
  });
});
