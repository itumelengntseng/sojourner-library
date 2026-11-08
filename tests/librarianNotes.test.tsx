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
    expect(readFileSync("app/works/[slug]/read/page.tsx", "utf8").match(/bookAnnotations={bookAnnotations} chapterAnnotations={chapterAnnotations} \/>/g)).toHaveLength(2);
  });
});

describe("the notes question as a chip (C185)", () => {
  it("is offered once the book has a note or highlight, and the fallback reply keeps step", async () => {
    const { suggestedQuestions, NOTES_QUESTION } = await import("@/lib/librarian");
    expect(suggestedQuestions(facts, { notes: 0, highlights: 1 })).toContain(NOTES_QUESTION);
    expect(suggestedQuestions(facts, { notes: 0, highlights: 0 })).not.toContain(NOTES_QUESTION);
    expect(suggestedQuestions(facts)).not.toContain(NOTES_QUESTION);
    for (const a of [{ notes: 2, highlights: 0 }, { notes: 0, highlights: 0 }]) {
      const said = [...ask("?", ctx(a)).text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      expect(said.sort()).toEqual(suggestedQuestions(facts, a).sort());
    }
  });
  it("renders the chip from server counts", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { AskLibrarian } = await import("@/components/AskLibrarian");
    expect(renderToStaticMarkup(<AskLibrarian title="T" facts={facts} annotations={{ notes: 1, highlights: 0 }} />)).toContain("How many notes have I made?");
    expect(renderToStaticMarkup(<AskLibrarian title="T" facts={facts} annotations={{ notes: 0, highlights: 0 }} />)).not.toContain("How many notes have I made?");
    expect(renderToStaticMarkup(<AskLibrarian title="T" facts={facts} annotations={() => ({ notes: 0, highlights: 2 })} />)).toContain("How many notes have I made?");
  });
});

describe("the reading room's answer counts a note removed a moment ago (C190)", () => {
  it("library mode: server count, with this chapter as it stands now", async () => {
    const { liveBookCount } = await import("@/lib/notesCount");
    const server = { notes: 5, highlights: 2 }; // whole book at page load
    const loaded = { notes: 2, highlights: 1 }; // this chapter at page load
    // One note removed, one highlight added since.
    const now = liveBookCount(server, loaded, { notes: 1, highlights: 2 });
    expect(now).toEqual({ notes: 4, highlights: 3 });
    expect(ask("How many notes have I made?", ctx(now)).text).toBe("You have 4 margin notes and 3 highlights in this book.");
    // Removing the last ones never goes below nothing.
    expect(liveBookCount({ notes: 1, highlights: 0 }, { notes: 1, highlights: 0 }, { notes: 0, highlights: 0 })).toEqual({ notes: 0, highlights: 0 });
    expect(ask("How many notes have I made?", ctx({ notes: 0, highlights: 0 })).text).toBe("You haven't made any notes or highlights in this book yet.");
  });
  it("preview: a removed note is gone from this browser's store, so the next count drops", () => {
    const store: Record<string, string> = { "soj:ann:w:1": JSON.stringify({ notes: [{ id: "a" }, { id: "b" }], highlights: [] }) };
    expect(previewBookCount("w", [1], (k) => store[k] ?? null).notes).toBe(2);
    store["soj:ann:w:1"] = JSON.stringify({ notes: [{ id: "b" }], highlights: [] }); // what removeNote persists
    expect(previewBookCount("w", [1], (k) => store[k] ?? null).notes).toBe(1);
  });
  it("the reading room wires it live: removal updates state and the store; the librarian reads a getter at ask time", () => {
    const room = readFileSync("components/ReaderView.tsx", "utf8");
    const remove = room.slice(room.indexOf("const removeNote"), room.indexOf("const turnPage"));
    expect(remove).toContain("setNotes(next);");
    expect(remove).toContain("persistPreview(next, highlights);");
    expect(room).toContain(": bookAnnotations ? () => liveCount(notes, highlights) : undefined}");
    const lib = readFileSync("components/AskLibrarian.tsx", "utf8");
    expect(lib).toContain('if (typeof src === "function") return src();');
    expect(lib).toContain("annotations: resolveNotes(annotations)");
  });
});

describe("Where are my notes? (C199)", () => {
  it("recognises close phrasings; the count question stays a count", async () => {
    const { isNotesWhereQuestion } = await import("@/lib/engine/ask");
    for (const q of ["Where are my notes?", "Which chapters have my highlights?", "where did I make notes", "In which chapter are my notes?"]) expect(isNotesWhereQuestion(q), q).toBe(true);
    for (const q of ["How many notes have I made?", "Have I highlighted anything?", "Where am I?", "How long to finish?"]) expect(isNotesWhereQuestion(q), q).toBe(false);
  });
  it("answers with chapter titles only, in book order", () => {
    const c = { ...ctx({ notes: 2, highlights: 1 }), notesWhere: ["Placeholder chapter 1", "Placeholder chapter 3"] };
    expect(ask("Where are my notes?", c)).toEqual({ kind: "notes_where", chapters: ["Placeholder chapter 1", "Placeholder chapter 3"], text: "Your notes and highlights are in Placeholder chapter 1 and Placeholder chapter 3." });
    expect(ask("Where are my notes?", { ...c, notesWhere: ["A", "B", "C"] }).text).toBe("Your notes and highlights are in A, B and C.");
    expect(ask("Where are my notes?", { ...c, notesWhere: ["A"] }).text).toBe("Your notes and highlights are in A.");
    expect(ask("How many notes have I made?", c).text).toBe("You have 2 margin notes and 1 highlight in this book.");
  });
  it("none yet; the proof copy keeps none; unknown places fall back to the count", () => {
    expect(ask("Where are my notes?", { ...ctx({ notes: 0, highlights: 0 }), notesWhere: [] }).text).toBe("You haven't made any notes or highlights in this book yet.");
    expect(ask("Where are my notes?", ctx(undefined)).text).toBe("Notes and highlights aren't kept in this copy.");
    expect(ask("Where are my notes?", ctx({ notes: 1, highlights: 0 })).text).toBe("You have 1 margin note in this book.");
    expect(ask("Where are my notes?", { ...ctx({ notes: 1, highlights: 0 }), notesWhere: [] }).text).toBe("You have 1 margin note in this book.");
  });
  it("the work page and reading room pass where the notes are; the proof copy passes none", () => {
    expect(readFileSync("app/works/[slug]/page.tsx", "utf8")).toContain("notesWhere={byChapter ? work.chapters.filter((c) => byChapter[c.position]).map((c) => c.title) : { slug: work.slug, chapters:");
    expect(readFileSync("components/ReaderView.tsx", "utf8")).toContain("notesWhere={proof ? undefined : () => chapters.filter(");
    expect(readFileSync("components/AskLibrarian.tsx", "utf8")).toContain("notesWhere: resolveWhere(notesWhere)");
  });
});
