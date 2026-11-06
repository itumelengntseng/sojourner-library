import { describe, expect, it } from "vitest";
import { getWork } from "@/lib/catalogue";
import { countWords } from "@/lib/engine/readingTime";
import {
  bookmarkOffset, cleanNote, locateBookmark, normaliseSelection, notesByParagraph, paragraphAtWord,
  parseSettings, segmentParagraph, splitParagraphs, wordsBeforeChapter, DEFAULT_SETTINGS, FONT_MAX,
} from "@/lib/reader";

const body = "First line here.\n\n  Second para\nstill second.\n\n\nThird one.";

describe("paragraphs", () => {
  it("splits on blank lines and keeps exact offsets", () => {
    const ps = splitParagraphs(body);
    expect(ps.map((p) => p.text)).toEqual(["First line here.", "Second para\nstill second.", "Third one."]);
    for (const p of ps) expect(body.slice(p.start, p.end)).toBe(p.text);
    expect(ps.map((p) => p.wordsBefore)).toEqual([0, 3, 7]);
  });
  it("handles the placeholder catalogue", () => {
    const ch = getWork("placeholder-work-one")!.chapters[0];
    const ps = splitParagraphs(ch.body);
    expect(ps).toHaveLength(12);
    const last = ps[ps.length - 1];
    expect(last.wordsBefore + countWords(last.text)).toBe(countWords(ch.body));
  });
});

describe("bookmarks", () => {
  const chapters = [{ position: 1, words: 100 }, { position: 2, words: 50 }, { position: 3, words: 80 }];
  it("counts words before a chapter", () => {
    expect(wordsBeforeChapter(chapters, 1)).toBe(0);
    expect(wordsBeforeChapter(chapters, 3)).toBe(150);
  });
  it("round-trips a paragraph to a work offset and back", () => {
    const ps = splitParagraphs(body);
    const off = bookmarkOffset(chapters, 2, ps[2]);
    expect(off).toBe(107);
    const at = locateBookmark(chapters, off);
    expect(at).toEqual({ position: 2, wordsIntoChapter: 7 });
    expect(paragraphAtWord(ps, at.wordsIntoChapter)).toBe(2);
  });
  it("puts an offset past the end on the last chapter", () => {
    expect(locateBookmark(chapters, 999)).toEqual({ position: 3, wordsIntoChapter: 80 });
  });
});

describe("highlights", () => {
  const p = splitParagraphs("abcdefghij")[0];
  it("cuts a paragraph into runs", () => {
    const segs = segmentParagraph(p, [{ id: "h", start: 2, end: 5, colour: "ochre" }]);
    expect(segs.map((s) => [s.text, s.highlight?.id ?? null])).toEqual([["ab", null], ["cde", "h"], ["fghij", null]]);
  });
  it("clips highlights to the paragraph and lets later ones win overlaps", () => {
    const segs = segmentParagraph(p, [
      { id: "a", start: -5, end: 4, colour: "sky" },
      { id: "b", start: 3, end: 50, colour: "lamplight" },
    ]);
    expect(segs.map((s) => [s.text, s.highlight?.id])).toEqual([["abc", "a"], ["defghij", "b"]]);
  });
  it("normalises selections, trimming spaces and reversing backwards drags", () => {
    expect(normaliseSelection("  hello  ", 9, 0)).toEqual({ start: 2, end: 7 });
    expect(normaliseSelection("   ", 0, 3)).toBeNull();
    expect(normaliseSelection("abc", 1, 99)).toEqual({ start: 1, end: 3 });
  });
});

describe("margin notes", () => {
  it("cleans and bounds note text", () => {
    expect(cleanNote("  a thought \r\n")).toBe("a thought");
    expect(cleanNote("   ")).toBeNull();
    expect(cleanNote("x".repeat(10_001))).toBeNull();
  });
  it("files notes beside their paragraph, oldest first", () => {
    const ps = splitParagraphs(body);
    const map = notesByParagraph(ps, [
      { id: "2", anchor: ps[1].start, body: "later", createdAt: 2 },
      { id: "1", anchor: ps[1].start, body: "earlier", createdAt: 1 },
      { id: "3", anchor: 0, body: "top", createdAt: 3 },
    ]);
    expect(map.get(1)!.map((n) => n.id)).toEqual(["1", "2"]);
    expect(map.get(0)!.map((n) => n.id)).toEqual(["3"]);
  });
});

describe("reader settings", () => {
  it("falls back to defaults on junk", () => {
    expect(parseSettings("nope")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
  it("keeps valid choices and clamps the font size", () => {
    expect(parseSettings(JSON.stringify({ theme: "sepia", layout: "paged", fontSize: 99 })))
      .toEqual({ theme: "sepia", layout: "paged", fontSize: FONT_MAX });
    expect(parseSettings(JSON.stringify({ theme: "neon" })).theme).toBe("dark");
  });
});
