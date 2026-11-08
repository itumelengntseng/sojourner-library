import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { countByChapter, previewByChapter, shortNotesLine } from "@/lib/notesCount";

// C197: the reading room's Contents drawer says which chapters hold the reader's notes.
describe("Contents drawer notes per chapter (C197)", () => {
  it("library rows are counted by chapter position (unknown chapters skipped)", () => {
    const by = countByChapter([{ chapter_id: "c1" }, { chapter_id: "c1" }, { chapter_id: "c3" }, { chapter_id: "gone" }], [{ chapter_id: "c3" }], { c1: 1, c2: 2, c3: 3 });
    expect(by).toEqual({ 1: { notes: 2, highlights: 0 }, 3: { notes: 1, highlights: 1 } });
    expect(shortNotesLine(by[1])).toBe(" · 2 notes");
    expect(shortNotesLine(by[2])).toBeNull();
  });
  it("preview counts this browser's chapters, leaving out empty and damaged ones", () => {
    const store: Record<string, string> = { "soj:ann:w:1": JSON.stringify({ notes: [1], highlights: [1, 2] }), "soj:ann:w:2": JSON.stringify({ notes: [], highlights: [] }), "soj:ann:w:3": "{bad" };
    expect(previewByChapter("w", [1, 2, 3, 4], (k) => store[k] ?? null)).toEqual({ 1: { notes: 1, highlights: 2 } });
  });
  it("the reading room shows it in Contents (this chapter live; none in the proof copy) and the page passes library counts", () => {
    const room = readFileSync("components/ReaderView.tsx", "utf8");
    expect(room).toContain("position === chapter.position ? { notes: notes.length, highlights: highlights.length }");
    expect(room).toContain("const chapterCount = (position: number): AnnotationCount | undefined => proof ? undefined");
    expect(room).toContain("{shortNotesLine(chapterCount(c.position)) &&");
    expect(readFileSync("app/works/[slug]/read/page.tsx", "utf8")).toContain("myAnnotationsByChapter(slug)");
    const store = readFileSync("lib/ledgerStore.ts", "utf8");
    const fn = store.slice(store.indexOf("export async function myAnnotationsByChapter"), store.indexOf("\n}\n", store.indexOf("export async function myAnnotationsByChapter")));
    expect(fn.match(/\.eq\("reader_id", auth\.user\.id\)/g)).toHaveLength(2);
  });
});

describe("Contents notes-in-chapters line (C202)", () => {
  it("only once notes sit in more than one chapter", async () => {
    const { notesInChaptersLine } = await import("@/lib/notesCount");
    expect(notesInChaptersLine(0)).toBeNull();
    expect(notesInChaptersLine(1)).toBeNull();
    expect(notesInChaptersLine(2)).toBe(" · notes in 2 chapters");
  });
  it("the drawer's first line carries it, counted from the same per-chapter counts (none in the proof copy)", () => {
    const room = readFileSync("components/ReaderView.tsx", "utf8");
    expect(room).toContain("left in this book` : \"You're at the end of this book\"}{notesInChaptersLine(notedChapters.length)}");
    expect(room).toContain("const notedChapters = chapters.filter((c) => { const n = chapterCount(c.position); return !!n && n.notes + n.highlights > 0; });");
  });
});
