import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { chaptersRead } from "@/lib/ledger";
import { ChapterMarks } from "@/components/ChapterMarks";

const s = (chapterKey: string, wordsRead: number, endedAt = 1) => ({ workKey: "w", chapterKey, wordsRead, activeMs: 0, endedAt });

describe("chapter marks (C28)", () => {
  it("marks a chapter read at 90% of its words, summed over sessions", () => {
    const chapters = [{ key: "1", words: 1000 }, { key: "2", words: 1000 }, { key: "3", words: 1000 }];
    expect(chaptersRead([s("1", 500), s("1", 400), s("2", 899), s("3", 2000)], chapters)).toEqual(["1", "3"]);
    expect(chaptersRead([], chapters)).toEqual([]);
  });
  it("never counts an empty chapter or another chapter's sessions", () => {
    expect(chaptersRead([s("1", 5000)], [{ key: "1", words: 0 }, { key: "2", words: 10 }])).toEqual([]);
  });
  it("renders nothing, a read tick, or the bookmark label", () => {
    expect(renderToStaticMarkup(<ChapterMarks read={false} here={false} />)).toBe("");
    expect(renderToStaticMarkup(<ChapterMarks read here={false} />)).toContain("read");
    const both = renderToStaticMarkup(<ChapterMarks read here />);
    expect(both).toContain("your bookmark");
    expect(both).toContain('aria-hidden="true"');
  });
});
