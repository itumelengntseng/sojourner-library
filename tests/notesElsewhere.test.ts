import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { elsewhereLine } from "@/lib/notesCount";

// C207: a chapter without the reader's notes says how many sit elsewhere in the book.
describe("notes elsewhere in this book (C207)", () => {
  it("counts notes and highlights in other chapters when this one holds none", () => {
    expect(elsewhereLine({ notes: 0, highlights: 0 }, [{ notes: 1, highlights: 0 }, undefined, { notes: 0, highlights: 1 }])).toBe("No notes in this chapter yet · 2 elsewhere in this book");
    expect(elsewhereLine(undefined, [{ notes: 1, highlights: 0 }])).toBe("No notes in this chapter yet · 1 elsewhere in this book");
  });
  it("says nothing when this chapter has some, or the book has none", () => {
    expect(elsewhereLine({ notes: 1, highlights: 0 }, [{ notes: 3, highlights: 0 }])).toBeNull();
    expect(elsewhereLine({ notes: 0, highlights: 1 }, [{ notes: 3, highlights: 0 }])).toBeNull();
    expect(elsewhereLine({ notes: 0, highlights: 0 }, [undefined, { notes: 0, highlights: 0 }])).toBeNull();
  });
  it("the reading room shows it from the Contents counts (this chapter live), never in the proof copy", () => {
    const room = readFileSync("components/ReaderView.tsx", "utf8");
    expect(room).toContain("{!proof && (() => {\n          const line = elsewhereLine(chapterCount(chapter.position), chapters.filter((c) => c.position !== chapter.position).map((c) => chapterCount(c.position)));");
    expect(room).toContain('data-notes-elsewhere=""');
  });
});

// C210: the line ends with a button that opens the Contents drawer.
describe("see Contents from the elsewhere line (C210)", () => {
  it("opens the drawer and focuses its toggle; spoken 'open Contents to find your notes'", () => {
    const room = readFileSync("components/ReaderView.tsx", "utf8");
    expect(room).toContain('{line} · <button type="button" aria-label="open Contents to find your notes" onClick={openContents}');
    const fn = room.slice(room.indexOf("const openContents = () => {"), room.indexOf("};", room.indexOf("const openContents = () => {")));
    expect(fn).toContain("d.open = true;");
    expect(fn).toContain('d.querySelector("summary")?.focus();');
  });
});
