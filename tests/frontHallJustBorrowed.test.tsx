import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JustBorrowedNote } from "@/components/JustBorrowedNote";
import type { OnLoan } from "@/lib/loanDesk";

const NOW = Date.parse("2026-11-07T10:00:00Z");
const M = 60_000;
const loan = (slug: string, agoMin: number, resume = false): OnLoan => ({
  workKey: slug, slug, title: `Placeholder ${slug}`, due: "Sat, 07 Nov, 13:00", timeLeft: "3 h", dueSoon: false, resume,
  dueAt: NOW + 3 * 60 * M, bookmark: resume ? 120 : 0, renewalsLeft: 3, borrowedAt: NOW - agoMin * M, borrowed: "Sat, 07 Nov, 11:50",
});

describe("front hall — Just borrowed note (C143)", () => {
  it("names the newest unopened loan taken out within the hour and links into the reading room", () => {
    const html = renderToStaticMarkup(<JustBorrowedNote loans={[loan("a", 30), loan("b", 10)]} now={NOW} />);
    expect(html).toContain('<span aria-hidden="true" class="text-lamplight">Just borrowed</span><span class="sr-only">Just borrowed, Sat, 07 Nov, 11:50:</span>');
    expect(html).toContain("Placeholder b");
    expect(html).not.toContain("Placeholder a");
    expect(html).toContain('href="/works/b/read"');
    expect(html).toContain("open it in the reading room");
  });
  it("leaves out loans older than the hour and ones already opened", () => {
    expect(renderToStaticMarkup(<JustBorrowedNote loans={[loan("a", 61)]} now={NOW} />)).toBe("");
    expect(renderToStaticMarkup(<JustBorrowedNote loans={[loan("a", 5, true)]} now={NOW} />)).toBe("");
  });
  it("shows only with no Continue card and nothing just returned", () => {
    const src = readFileSync("app/page.tsx", "utf8");
    expect(src).toContain("{!cont && !returned.some((r) => justReturned(r, now)) && <JustBorrowedNote loans={open} now={now} />}");
  });
});
