import { describe, expect, it } from "vitest";

describe("notes across the library (C179)", () => {
  it("totals notes and highlights and counts the books that have any", async () => {
    const { totalAnnotations, notesAcrossLine } = await import("@/lib/notesCount");
    const t = totalAnnotations({
      a: [JSON.stringify({ notes: [1, 2], highlights: [1] }), null],
      b: ["{broken", JSON.stringify({ notes: [1] })],
      c: [null, JSON.stringify({ notes: [], highlights: [] })],
    });
    expect(t).toEqual({ notes: 3, highlights: 1, books: 2 });
    expect(notesAcrossLine(t)).toBe("3 margin notes · 1 highlight across 2 books");
    expect(notesAcrossLine({ notes: 0, highlights: 1, books: 1 })).toBe("1 highlight across 1 book");
    expect(notesAcrossLine({ notes: 0, highlights: 0, books: 0 })).toBeNull();
  });
});

describe("short notes line (C186)", () => {
  it("words the counts beside a time", async () => {
    const { shortNotesLine } = await import("@/lib/notesCount");
    expect(shortNotesLine({ notes: 2, highlights: 1 })).toBe(" · 2 notes · 1 highlight");
    expect(shortNotesLine({ notes: 1, highlights: 0 })).toBe(" · 1 note");
    expect(shortNotesLine({ notes: 0, highlights: 0 })).toBeNull();
    expect(shortNotesLine(undefined)).toBeNull();
  });
});

describe("note saved status (C187)", () => {
  it("says the book's own count after a note is saved", async () => {
    const { noteSavedStatus } = await import("@/lib/notesCount");
    expect(noteSavedStatus(3)).toBe("Note saved · 3 in this book");
    expect(noteSavedStatus(1)).toBe("Note saved · 1 in this book");
    expect(noteSavedStatus(undefined)).toBe("Note saved");
  });
  it("the reading room sets it after saving (the proof copy has no Note button)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("components/ReaderView.tsx", "utf8");
    expect(src).toContain("setStatus(noteSavedStatus(inBook));");
    expect(src).toContain('{!proof && <button type="button" onClick={startNote}');
  });
});

describe("highlight saved status (C188)", () => {
  it("says the book's own count after a highlight is saved", async () => {
    const { highlightSavedStatus } = await import("@/lib/notesCount");
    expect(highlightSavedStatus(2)).toBe("Highlight saved · 2 in this book");
    expect(highlightSavedStatus(1)).toBe("Highlight saved · 1 in this book");
    expect(highlightSavedStatus(0)).toBe("Highlight saved");
    expect(highlightSavedStatus(undefined)).toBe("Highlight saved");
  });
  it("the reading room sets it after a highlight, counting this browser's chapters in preview", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("components/ReaderView.tsx", "utf8");
    expect(src).toContain("setStatus(highlightSavedStatus(inBook));");
    expect(src).toContain("previewBookCount(slug, chapters.map((c) => c.position), readLocal).highlights");
  });
});

describe("removed status (C191)", () => {
  it("says what's left in the book", async () => {
    const { removedStatus } = await import("@/lib/notesCount");
    expect(removedStatus("note", 2)).toBe("Note removed · 2 left in this book");
    expect(removedStatus("highlight", 1)).toBe("Highlight removed · 1 left in this book");
    expect(removedStatus("note", 0)).toBe("Note removed · none left in this book");
    expect(removedStatus("highlight", undefined)).toBe("Highlight removed");
  });
  it("the reading room sets it after removing a note or a highlight", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("components/ReaderView.tsx", "utf8");
    expect(src).toContain('setStatus(removedStatus("note", preview ?');
    expect(src).toContain('setStatus(removedStatus("highlight", preview ?');
  });
});
