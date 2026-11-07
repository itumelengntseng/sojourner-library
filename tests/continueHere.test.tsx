import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContinueHere } from "@/components/ContinueHere";
import { chapterLabel, continueReading, type ContinueChapter } from "@/lib/continueReading";

const T = Date.parse("2026-11-06T10:00:00Z");
const chs: ContinueChapter[] = [1, 2, 3].map((p) => ({ key: String(p), position: p, title: `Placeholder chapter ${p}`, words: 1000 }));

describe("C49 continue at <chapter> on the work page", () => {
  it("shows nothing without a card", () => {
    expect(renderToStaticMarkup(<ContinueHere card={null} />)).toBe("");
  });
  it("names the chapter, links into it and says the minutes left", () => {
    const card = continueReading([{ workKey: "w", slug: "w", title: "Placeholder W", bookmarkOffset: 0 }],
      [{ workKey: "w", chapterKey: "2", wordsRead: 400, activeMs: 60_000, endedAt: T }], { w: chs }, 200)!;
    const html = renderToStaticMarkup(<ContinueHere card={card} />);
    expect(html).toContain("Continue at");
    expect(html).toContain('href="/works/w/read?ch=2"');
    expect(html).toContain("Chapter 2: Placeholder chapter 2");
    expect(html).toContain("about 3 min left in this chapter");
  });
  it("a chapter read through points on to the next one", () => {
    const card = continueReading([{ workKey: "w", slug: "w", title: "Placeholder W", bookmarkOffset: 0 }],
      [{ workKey: "w", chapterKey: "1", wordsRead: 950, activeMs: 60_000, endedAt: T }], { w: chs }, 200)!;
    expect(renderToStaticMarkup(<ContinueHere card={card} />)).toContain('href="/works/w/read?ch=2"');
  });
  it("chapter titles that already say 'Chapter' aren't doubled", () => {
    expect(chapterLabel({ chapterPosition: 4, chapterTitle: "Chapter Four" })).toBe("Chapter Four");
    expect(chapterLabel({ chapterPosition: 4, chapterTitle: "The yard" })).toBe("Chapter 4: The yard");
  });
});
