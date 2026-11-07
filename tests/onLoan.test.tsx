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
  it("C50: a loan the reader has read in shows Continue at <chapter>; others don't", async () => {
    const { continueReading } = await import("@/lib/continueReading");
    const loans = onLoanNow([loan({ id: "a", workId: "w1" }), loan({ id: "b", workId: "w2" })], "r", works, now);
    const card = continueReading([{ workKey: "placeholder-one", slug: "placeholder-one", title: "Placeholder One", bookmarkOffset: 0 }],
      [{ workKey: "placeholder-one", chapterKey: "3", wordsRead: 100, activeMs: 60_000, endedAt: now }],
      { "placeholder-one": [1, 2, 3].map((p) => ({ key: String(p), position: p, title: `Placeholder chapter ${p}`, words: 500 })) }, 200)!;
    const html = renderToStaticMarkup(<OnLoanNow loans={loans} continueAt={{ "placeholder-one": card }} />);
    expect(html.match(/Continue at/g)).toHaveLength(1);
    expect(html).toContain('href="/works/placeholder-one/read?ch=3"');
    expect(html).toContain("Chapter 3: Placeholder chapter 3");
    expect(html).toContain("about 2 min left in this chapter");
  });
});

describe("Due soon mark on On loan now (C96)", () => {
  const on = (slug: string, dueAt: number): import("@/lib/loanDesk").OnLoan => ({ workKey: slug, slug, title: `Placeholder ${slug}`, due: "SAT 7 NOV, 14:00", timeLeft: "3 h", dueSoon: false, resume: false, dueAt, bookmark: 0 });
  it("marks only the loans due back within the day, with the due time spoken", async () => {
    const { OnLoanNow } = await import("@/components/OnLoanNow");
    const { dueBackSoon } = await import("@/lib/loanDesk");
    const now = Date.parse("2026-11-07T09:00:00Z");
    const loans = [on("soon", now + 3 * 3600_000), on("later", now + 3 * 86_400_000)];
    const html = renderToStaticMarkup(<OnLoanNow loans={loans} dueSoon={dueBackSoon(loans, now).map((l) => l.slug)} />);
    expect(html.match(/Due soon<span class="sr-only">: back by SAT 7 NOV, 14:00<\/span>/g)).toHaveLength(1);
    expect(html.indexOf("Due soon")).toBeLessThan(html.indexOf("Placeholder later"));
    expect(renderToStaticMarkup(<OnLoanNow loans={loans} />)).not.toContain("Due soon");
  });
});
