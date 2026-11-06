import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ask } from "@/lib/engine/ask";
import { librarianFacts, SUGGESTED_QUESTIONS, toReaderContext } from "@/lib/librarian";
import { usualMinutesPerDay } from "@/lib/sessions";
import { AskLibrarian } from "@/components/AskLibrarian";

const chapters = [{ position: 1, words: 2300 }, { position: 2, words: 4600 }, { position: 3, words: 2300 }];
const now = new Date(Date.UTC(2026, 10, 6, 12)); // a Friday

describe("librarian facts", () => {
  it("starts at the beginning without a bookmark", () => {
    const f = librarianFacts({ chapters, bookmarkOffset: 0, wpm: 230, usualMinutesPerDay: 30 });
    expect(f).toMatchObject({ totalWords: 9200, wordsRead: 0, chapterPosition: 1, chapterWordsRemaining: 2300 });
  });
  it("reads from the bookmark", () => {
    const f = librarianFacts({ chapters, bookmarkOffset: 3450, wpm: 230, usualMinutesPerDay: 30 });
    expect(f).toMatchObject({ wordsRead: 3450, chapterPosition: 2, chapterWordsRemaining: 3450 });
  });
  it("clamps a bookmark beyond the end", () => {
    expect(librarianFacts({ chapters, bookmarkOffset: 99_999, wpm: 230, usualMinutesPerDay: 30 }).wordsRead).toBe(9200);
  });
  it("answers every suggested question", () => {
    const ctx = toReaderContext(librarianFacts({ chapters, bookmarkOffset: 3450, wpm: 230, usualMinutesPerDay: 30 }), now);
    const kinds = SUGGESTED_QUESTIONS.map((q) => ask(q, ctx).kind);
    expect(kinds).toEqual(["time_left", "deadline", "per_day", "chapter_left"]);
    expect(ask("Time left in this chapter?", ctx).text).toBe("About 15 min left in this chapter.");
    expect(ask("How long to finish?", ctx).text).toMatch(/25 min to finish/);
  });
});

describe("usual minutes per day", () => {
  const day = 86_400_000;
  const t = Date.UTC(2026, 10, 6, 20);
  it("defaults to half an hour", () => {
    expect(usualMinutesPerDay([])).toBe(30);
    expect(usualMinutesPerDay([{ wordsRead: 200, activeMs: 60_000, endedAt: t }])).toBe(30);
  });
  it("averages across reading days in the last fortnight", () => {
    expect(usualMinutesPerDay([
      { wordsRead: 1, activeMs: 20 * 60_000, endedAt: t },
      { wordsRead: 1, activeMs: 20 * 60_000, endedAt: t - 3600_000 },
      { wordsRead: 1, activeMs: 20 * 60_000, endedAt: t - 2 * day },
      { wordsRead: 1, activeMs: 500 * 60_000, endedAt: t - 30 * day },
    ])).toBe(30);
    expect(usualMinutesPerDay([{ wordsRead: 1, activeMs: 50 * 60_000, endedAt: t }])).toBe(50);
  });
});

describe("the librarian's desk", () => {
  it("renders with suggestions and the reader's pace", () => {
    const html = renderToStaticMarkup(
      <AskLibrarian title="Placeholder Work One" facts={librarianFacts({ chapters, bookmarkOffset: 0, wpm: 260, usualMinutesPerDay: 30 })} />,
    );
    expect(html).toContain("Ask the librarian");
    expect(html).toContain("260 wpm");
    for (const q of SUGGESTED_QUESTIONS) expect(html).toContain(q);
  });
});
