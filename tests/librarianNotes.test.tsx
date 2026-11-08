import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ask, isNotesQuestion } from "@/lib/engine/ask";
import { librarianFacts, toReaderContext } from "@/lib/librarian";
import { previewBookCount } from "@/lib/notesCount";

// C183: the librarian answers "How many notes have I made?" from the reader's own counts for this book.
const facts = librarianFacts({ chapters: [{ position: 1, words: 2300 }], bookmarkOffset: 0, wpm: 230, usualMinutesPerDay: 30 });
const ctx = (annotations?: { notes: number; highlights: number }) => ({ ...toReaderContext(facts, new Date(Date.UTC(2026, 10, 8))), annotations });

describe("How many notes have I made? (C183)", () => {
  it("recognises close phrasings and leaves the others alone", () => {
    for (const q of ["How many notes have I made?", "Have I highlighted anything?", "my notes in this book", "Did I make any notes?", "how many highlights"]) expect(isNotesQuestion(q), q).toBe(true);
    for (const q of ["How long to finish?", "Time left in this chapter?", "How long have I read this book?", "notes"]) expect(isNotesQuestion(q), q).toBe(false);
  });
  it("answers from own counts", () => {
    expect(ask("How many notes have I made?", ctx({ notes: 2, highlights: 1 }))).toEqual({ kind: "notes", notes: 2, highlights: 1, text: "You have 2 margin notes and 1 highlight in this book." });
    expect(ask("How many notes have I made?", ctx({ notes: 0, highlights: 3 })).text).toBe("You have 3 highlights in this book.");
    expect(ask("How many notes have I made?", ctx({ notes: 0, highlights: 0 })).text).toBe("You haven't made any notes or highlights in this book yet.");
    expect(ask("How many notes have I made?", ctx(undefined)).text).toBe("Notes and highlights aren't kept in this copy.");
  });
  it("preview counts this browser's chapters for the book", () => {
    const store: Record<string, string> = { "soj:ann:w:1": JSON.stringify({ notes: [1], highlights: [1, 2] }), "soj:ann:w:2": JSON.stringify({ notes: [1] }), "soj:ann:x:1": JSON.stringify({ notes: [1, 2, 3] }) };
    expect(previewBookCount("w", [1, 2, 3], (k) => store[k] ?? null)).toEqual({ notes: 2, highlights: 2 });
  });
  it("the work page and reading room pass a source; the proof copy passes none", () => {
    expect(readFileSync("app/works/[slug]/page.tsx", "utf8")).toContain("annotations={annotations ?? { slug: work.slug, positions: work.chapters.map((c) => c.position) }}");
    const room = readFileSync("components/ReaderView.tsx", "utf8");
    expect(room).toContain("annotations={proof ? undefined : preview ?");
    expect(readFileSync("app/works/[slug]/read/page.tsx", "utf8").match(/bookAnnotations={bookAnnotations} \/>/g)).toHaveLength(2);
  });
});
