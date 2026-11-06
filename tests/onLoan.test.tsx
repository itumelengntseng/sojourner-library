import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OnLoanNow } from "@/components/OnLoanNow";
import { onLoanNow } from "@/lib/loanDesk";
import type { Loan } from "@/lib/engine/checkout";

const now = Date.parse("2026-11-06T10:00:00Z");
const loan = (o: Partial<Loan>): Loan => ({
  id: "l", workId: "w1", readerId: "r", period: "two_weeks", borrowedAt: now - 3_600_000, dueAt: now + 86_400_000,
  renewals: 0, returnedAt: null, bookmark: { chapterIndex: 0, wordOffset: 0 }, ...o,
});
const works = { w1: { slug: "placeholder-one", title: "Placeholder One" }, w2: { slug: "placeholder-two", title: "Placeholder Two" } };

describe("on loan now", () => {
  it("lists only this reader's open loans, soonest due first", () => {
    const list = onLoanNow([
      loan({ id: "a", workId: "w1", dueAt: now + 2 * 86_400_000 }),
      loan({ id: "b", workId: "w2", dueAt: now + 10 * 60_000, bookmark: { chapterIndex: 0, wordOffset: 40 } }),
      loan({ id: "c", workId: "w1", returnedAt: now - 1000 }),
      loan({ id: "d", workId: "w1", dueAt: now - 1000 }),
      loan({ id: "e", workId: "w1", readerId: "someone-else" }),
      loan({ id: "f", workId: "unknown" }),
    ], "r", works, now);
    expect(list.map((l) => [l.slug, l.dueSoon, l.resume])).toEqual([["placeholder-two", true, true], ["placeholder-one", false, false]]);
    expect(list[0].timeLeft).toBe("10 min");
  });
  it("renders a resume link and the due stamp, or a way to the halls", () => {
    const html = renderToStaticMarkup(<OnLoanNow loans={onLoanNow([loan({ bookmark: { chapterIndex: 0, wordOffset: 9 } })], "r", works, now)} />);
    expect(html).toContain('href="/works/placeholder-one/read"');
    expect(html).toContain("Resume");
    expect(html).toMatch(/Due .*1 day left/);
    expect(renderToStaticMarkup(<OnLoanNow loans={[]} />)).toContain('href="/halls"');
  });
});
