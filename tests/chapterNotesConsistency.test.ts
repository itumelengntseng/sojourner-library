import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { countAnnotations, countByChapter, notesInChaptersLine, previewByChapter, sumCounts, previewBookCount } from "@/lib/notesCount";
import { ask } from "@/lib/engine/ask";
import { librarianFacts, toReaderContext } from "@/lib/librarian";

// C205: from one store, the Contents drawer, the work page's noted marks, "notes in N chapters",
// the end card's total and the librarian's "Where are my notes?" all name the same chapters.
const chapters = [1, 2, 3, 4].map((p) => ({ position: p, title: `Placeholder chapter ${p}` }));
const store: Record<string, string> = {
  "soj:ann:w:1": JSON.stringify({ notes: [{ id: "a" }], highlights: [] }),
  "soj:ann:w:2": JSON.stringify({ notes: [], highlights: [] }),
  "soj:ann:w:3": JSON.stringify({ notes: [], highlights: [{ id: "h" }, { id: "i" }] }),
  "soj:ann:w:4": "{damaged",
};
const read = (k: string) => store[k] ?? null;
const facts = librarianFacts({ chapters: [{ position: 1, words: 2300 }], bookmarkOffset: 0, wpm: 230, usualMinutesPerDay: 30 });

describe("chapter notes agree everywhere (C205)", () => {
  it("preview: drawer, noted marks, chapters line, end card and the librarian", () => {
    const drawer = previewByChapter("w", chapters.map((c) => c.position), read);
    const noted = chapters.filter((c) => { const n = countAnnotations([read(`soj:ann:w:${c.position}`)]); return n.notes + n.highlights > 0; }); // NotedMark's rule
    expect(Object.keys(drawer).map(Number)).toEqual(noted.map((c) => c.position));
    expect(noted.map((c) => c.position)).toEqual([1, 3]);
    expect(notesInChaptersLine(noted.length)).toBe(" · notes in 2 chapters");
    const book = sumCounts(chapters.map((c) => drawer[c.position]));
    expect(book).toEqual(previewBookCount("w", chapters.map((c) => c.position), read));
    const where = noted.map((c) => c.title);
    expect(ask("Where are my notes?", { ...toReaderContext(facts, new Date(Date.UTC(2026, 10, 8))), annotations: book, notesWhere: where }).text)
      .toBe("Your notes and highlights are in Placeholder chapter 1 and Placeholder chapter 3.");
  });
  it("library: rows by chapter id give the same chapters the work page and drawer show", () => {
    const by = countByChapter([{ chapter_id: "id1" }], [{ chapter_id: "id3" }, { chapter_id: "id3" }], { id1: 1, id2: 2, id3: 3, id4: 4 });
    expect(chapters.filter((c) => by[c.position]).map((c) => c.position)).toEqual([1, 3]);
    expect(sumCounts(Object.values(by))).toEqual({ notes: 1, highlights: 2 });
  });
  it("the work page and the reading room use these same rules", () => {
    expect(readFileSync("app/works/[slug]/page.tsx", "utf8")).toContain("work.chapters.filter((c) => byChapter[c.position]).map((c) => c.title)");
    const room = readFileSync("components/ReaderView.tsx", "utf8");
    expect(room).toContain("notesInChaptersLine(notedChapters.length)");
    expect(room).toContain("notedChapters.map((c) => c.title)");
    expect(room).toContain("sumCounts(chapters.map((c) => chapterCount(c.position)))");
    expect(readFileSync("components/AskLibrarian.tsx", "utf8")).toContain("src.chapters.filter((c) => by[c.position]).map((c) => c.title)");
  });
});
