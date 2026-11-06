import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { recentlyReturned } from "@/lib/loanDesk";
import { RecentlyReturned } from "@/components/RecentlyReturned";
import type { Loan } from "@/lib/engine/checkout";

const NOW = Date.parse("2026-11-06T10:00:00Z");
const H = 3600_000;
const W = Object.fromEntries(["a", "b", "c", "d", "e", "f", "g"].map((k) => [k, { slug: `work-${k}`, title: `Placeholder ${k}` }]));
const loan = (id: string, workId: string, borrowedAgo: number, returnedAgo: number | null, readerId = "me", dueIn = 10 * H): Loan => ({
  id, workId, readerId, period: "two_weeks", borrowedAt: NOW - borrowedAgo * H, dueAt: NOW + dueIn,
  returnedAt: returnedAgo === null ? null : NOW - returnedAgo * H, renewals: 0, bookmark: { chapterIndex: 0, wordOffset: 0 },
});

describe("recently returned", () => {
  it("newest return first, one line per work, own loans only, at most five", () => {
    const loans = [
      loan("1", "a", 50, 40), loan("2", "a", 30, 20), loan("3", "b", 30, 25), loan("4", "c", 30, 2),
      loan("5", "d", 30, 3), loan("6", "e", 30, 4), loan("7", "f", 30, 5), loan("x", "g", 30, 1, "someone-else"),
    ];
    const out = recentlyReturned(loans, "me", W, NOW);
    expect(out.map((r) => r.workKey)).toEqual(["c", "d", "e", "f", "a"]);
    expect(out[4].returnedAt).toBe(NOW - 20 * H);
  });
  it("leaves out works out on loan again and works no longer on the shelves", () => {
    const loans = [loan("1", "a", 50, 40), loan("2", "a", 2, null), loan("3", "zzz", 30, 3)];
    expect(recentlyReturned(loans, "me", W, NOW)).toEqual([]);
  });
  it("counts an expired loan as returned at its due time", () => {
    const out = recentlyReturned([loan("1", "b", 30, null, "me", -2 * H)], "me", W, NOW);
    expect(out).toHaveLength(1);
    expect(out[0].returnedAt).toBe(NOW - 2 * H);
    expect(out[0].onTime).toBe(false);
  });
  it("renders nothing when nothing was returned, and a Borrow again link otherwise", () => {
    expect(renderToStaticMarkup(<RecentlyReturned items={[]} />)).toBe("");
    const html = renderToStaticMarkup(<RecentlyReturned items={recentlyReturned([loan("1", "a", 30, 2)], "me", W, NOW)} />);
    expect(html).toContain("Recently returned");
    expect(html).toContain('href="/works/work-a"');
    expect(html).toContain("Borrow again");
    expect(html).toContain("returned");
  });
});
