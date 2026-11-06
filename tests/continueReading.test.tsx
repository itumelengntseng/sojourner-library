import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContinueReading } from "@/components/ContinueReading";
import { continueReading, type ContinueChapter, type ContinueLoan } from "@/lib/continueReading";
import type { WorkSession } from "@/lib/ledger";
import { splitDueSoon, type OnLoan } from "@/lib/loanDesk";

const T = Date.parse("2026-11-06T10:00:00Z");
const chs = (n: number, words = 1000): ContinueChapter[] =>
  Array.from({ length: n }, (_, i) => ({ key: String(i + 1), position: i + 1, title: `Placeholder chapter ${i + 1}`, words }));
const loan = (slug: string, bookmarkOffset = 0): ContinueLoan => ({ workKey: slug, slug, title: `Placeholder ${slug}`, bookmarkOffset });
const sess = (workKey: string, chapterKey: string | undefined, wordsRead: number, endedAt: number): WorkSession =>
  ({ workKey, ...(chapterKey ? { chapterKey } : {}), wordsRead, activeMs: 60_000, endedAt });
const chapters = { a: chs(3), b: chs(2) };

describe("continue reading", () => {
  it("shows nothing with no open loans, or open loans never read", () => {
    expect(continueReading([], [sess("a", "1", 100, T)], chapters, 200)).toBeNull();
    expect(continueReading([loan("a")], [], chapters, 200)).toBeNull();
    expect(continueReading([loan("a")], [sess("z", "1", 100, T)], chapters, 200)).toBeNull();
  });
  it("picks the open loan read most recently, ignoring returned books' sessions", () => {
    const out = continueReading([loan("a"), loan("b")], [sess("a", "1", 100, T - 5000), sess("b", "2", 100, T), sess("c", "1", 1, T + 9)], chapters, 200);
    expect(out?.slug).toBe("b");
    expect(out?.chapterPosition).toBe(2);
  });
  it("uses the bookmark when it sits in the last chapter read, and links to resume there", () => {
    // bookmark 1250 words in → chapter 2, 250 words in → 750 left → 4 min at 200 wpm
    const out = continueReading([loan("a", 1250)], [sess("a", "2", 100, T)], chapters, 200)!;
    expect(out.chapterPosition).toBe(2);
    expect(out.wordsLeft).toBe(750);
    expect(out.minutesLeft).toBe(4);
    expect(out.left).toBe("about 4 min left in this chapter");
    expect(out.href).toBe("/works/a/read");
  });
  it("otherwise sums the reader's own sessions in that chapter, capped", () => {
    const out = continueReading([loan("a")], [sess("a", "3", 300, T - 10), sess("a", "3", 200, T)], chapters, 250)!;
    expect(out.chapterPosition).toBe(3);
    expect(out.wordsLeft).toBe(500);
    expect(out.href).toBe("/works/a/read?ch=3");
  });
  it("moves on to the next chapter once one is read through", () => {
    const out = continueReading([loan("a")], [sess("a", "1", 990, T)], chapters, 250)!;
    expect(out.chapterPosition).toBe(2);
    expect(out.wordsLeft).toBe(1000);
  });
  it("says the last chapter is read through rather than inventing a next one", () => {
    const out = continueReading([loan("b")], [sess("b", "2", 5000, T)], chapters, 250)!;
    expect(out.chapterPosition).toBe(2);
    expect(out.wordsLeft).toBe(0);
    expect(out.left).toBe("this chapter is read through");
  });
  it("falls back to the bookmark's chapter for sessions without a chapter", () => {
    const out = continueReading([loan("a", 2100)], [sess("a", undefined, 50, T)], chapters, 200)!;
    expect(out.chapterPosition).toBe(3);
    expect(out.href).toBe("/works/a/read");
  });
  it("renders a lamplit card with title, authorship, chapter, time left and Resume", () => {
    const card = continueReading([loan("a", 1250)], [sess("a", "2", 100, T)], chapters, 200);
    const html = renderToStaticMarkup(<ContinueReading card={card} />);
    expect(html).toContain("Continue reading");
    expect(html).toContain("Placeholder a");
    expect(html).toContain("by Itumeleng Ntseng");
    expect(html).toContain("Chapter 2: Placeholder chapter 2");
    expect(html).toContain("about 4 min left in this chapter");
    expect(html).toContain('href="/works/a/read"');
    expect(renderToStaticMarkup(<ContinueReading card={null} />)).toBe("");
    // A title that already says "Chapter …" isn't doubled.
    const plain = renderToStaticMarkup(<ContinueReading card={{ ...card!, chapterTitle: "Chapter 2" }} />);
    expect(plain).toContain(">Chapter 2<");
    expect(plain).not.toContain("Chapter 2: Chapter 2");
  });
  it("C37: sits full-width at the front desk when asked, centred on the front hall by default", () => {
    const card = continueReading([loan("a", 1250)], [sess("a", "2", 100, T)], chapters, 200);
    expect(renderToStaticMarkup(<ContinueReading card={card} />)).toContain("mx-auto mt-8");
    const desk = renderToStaticMarkup(<ContinueReading card={card} className="w-full" />);
    expect(desk).toContain("w-full");
    expect(desk).not.toContain("mx-auto");
  });
});

describe("due soon on the continue card (C42)", () => {
  const H = 3600_000;
  const on = (slug: string, inMs: number): OnLoan => ({ workKey: slug, slug, title: `Placeholder ${slug}`, due: "Fri 6 Nov, 14:00", timeLeft: "4 h", dueSoon: false, resume: true, dueAt: T + inMs });
  it("moves the continue book off the due-soon slip onto the card", () => {
    const soon = [on("a", 2 * H), on("b", 3 * H)];
    expect(splitDueSoon(soon, "a")).toEqual({ onCard: soon[0], onSlip: [soon[1]] });
    expect(splitDueSoon(soon, "z")).toEqual({ onCard: undefined, onSlip: soon });
    expect(splitDueSoon(soon, undefined)).toEqual({ onCard: undefined, onSlip: soon });
  });
  it("stamps the card with the due time and a way to renew", () => {
    const card = continueReading([loan("a", 1250)], [sess("a", "2", 100, T)], chapters, 200);
    const html = renderToStaticMarkup(<ContinueReading card={card} due={on("a", 4 * H)} />);
    expect(html).toContain("Due back Fri 6 Nov, 14:00 · 4 h left");
    expect(html).toContain('href="/card"');
    expect(renderToStaticMarkup(<ContinueReading card={card} />)).not.toContain("Due back");
  });
});
