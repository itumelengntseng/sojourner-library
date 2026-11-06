import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DueSoonSlip } from "@/components/DueSoonSlip";
import { dueBackSoon, type OnLoan } from "@/lib/loanDesk";

const NOW = Date.parse("2026-11-06T10:00:00Z");
const H = 3600_000;
const loan = (slug: string, inMs: number): OnLoan => ({ workKey: slug, slug, title: `Placeholder ${slug}`, due: "Fri 6 Nov, 14:00", timeLeft: "4 h", dueSoon: false, resume: false, dueAt: NOW + inMs });

describe("due back soon", () => {
  it("keeps only loans due within a day, soonest first", () => {
    const out = dueBackSoon([loan("c", 30 * H), loan("b", 20 * H), loan("a", 2 * H), loan("x", -1)], NOW);
    expect(out.map((l) => l.slug)).toEqual(["a", "b"]);
    expect(dueBackSoon([loan("e", 24 * H)], NOW)).toHaveLength(1);
    expect(dueBackSoon([loan("f", 24 * H + 1)], NOW)).toHaveLength(0);
  });
  it("shows nothing when nothing is due", () => {
    expect(renderToStaticMarkup(<DueSoonSlip loans={[]} />)).toBe("");
  });
  it("lists the due time, time left, a way back into the book and the front desk", () => {
    const html = renderToStaticMarkup(<DueSoonSlip loans={[loan("work-one", 4 * H)]} />);
    expect(html).toContain("Due back soon");
    expect(html).toContain('href="/works/work-one/read"');
    expect(html).toContain("Fri 6 Nov, 14:00 · 4 h left");
    expect(html).toContain('href="/card"');
  });
});
