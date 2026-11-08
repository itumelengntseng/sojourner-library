import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { annotationLine, countAnnotations, highlightSavedStatus, noteSavedStatus, previewBookCount, shortNotesLine, totalAnnotations, notesAcrossLine } from "@/lib/notesCount";
import { ask } from "@/lib/engine/ask";
import { librarianFacts, toReaderContext } from "@/lib/librarian";

// C195: from one browser store, every place that counts a book's notes says the same numbers —
// the work page line (YourNotes), Hours per book / Borrowing history / card / Continue reading (BookNotesCount),
// the librarian's answer, the reading room's saved status and the ledger's totals.
const store: Record<string, string> = {
  "soj:ann:placeholder-work-one:1": JSON.stringify({ notes: [{ id: "a" }, { id: "b" }], highlights: [{ id: "h" }] }),
  "soj:ann:placeholder-work-one:3": JSON.stringify({ notes: [{ id: "c" }], highlights: [] }),
  "soj:ann:placeholder-work-one:9": "{damaged",
  "soj:ann:placeholder-work-two:1": JSON.stringify({ notes: [], highlights: [{ id: "x" }, { id: "y" }] }),
};
const read = (k: string) => store[k] ?? null;
const positions = [1, 2, 3, 9];

describe("notes counts agree everywhere (C195)", () => {
  it("one book: work page, short line, librarian and saved statuses", () => {
    const work = countAnnotations(positions.map((p) => read(`soj:ann:placeholder-work-one:${p}`))); // YourNotes
    const book = previewBookCount("placeholder-work-one", positions, read); // BookNotesCount, reading room
    expect(book).toEqual(work);
    expect(book).toEqual({ notes: 3, highlights: 1 });
    expect(annotationLine(work)).toBe("3 margin notes and 1 highlight");
    expect(shortNotesLine(book)).toBe(" · 3 notes · 1 highlight");
    const facts = librarianFacts({ chapters: [{ position: 1, words: 2300 }], bookmarkOffset: 0, wpm: 230, usualMinutesPerDay: 30 });
    expect(ask("How many notes have I made?", { ...toReaderContext(facts, new Date(Date.UTC(2026, 10, 8))), annotations: book }).text)
      .toBe(`You have ${annotationLine(work)} in this book.`);
    expect(noteSavedStatus(book.notes)).toBe("Note saved · 3 in this book");
    expect(highlightSavedStatus(book.highlights)).toBe("Highlight saved · 1 in this book");
  });
  it("across books: the ledger's totals add up the per-book counts", () => {
    const one = previewBookCount("placeholder-work-one", positions, read);
    const two = previewBookCount("placeholder-work-two", [1], read);
    const totals = totalAnnotations({
      "placeholder-work-one": positions.map((p) => read(`soj:ann:placeholder-work-one:${p}`)),
      "placeholder-work-two": [read("soj:ann:placeholder-work-two:1")],
    });
    expect(totals).toEqual({ notes: one.notes + two.notes, highlights: one.highlights + two.highlights, books: 2 });
    expect(notesAcrossLine(totals)).toBe("3 margin notes · 3 highlights across 2 books");
  });
  it("library mode: every count reads only the reader's own rows", () => {
    const src = readFileSync("lib/ledgerStore.ts", "utf8");
    for (const fn of ["myAnnotationCount", "myAnnotationTotals", "myAnnotationsByWork"]) {
      const body = src.slice(src.indexOf(`export async function ${fn}`), src.indexOf("\n}\n", src.indexOf(`export async function ${fn}`)));
      expect(body.match(/\.eq\("reader_id", auth\.user\.id\)/g)?.length, fn).toBe(2);
    }
  });
});
