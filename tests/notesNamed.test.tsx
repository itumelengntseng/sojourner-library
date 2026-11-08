import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NotesTally } from "@/components/NotesTally";
import { annotatedTitles, bookNames, notesAcrossLine, totalAnnotations } from "@/lib/notesCount";

// C206: the ledger's "Your notes" line names the books when there are two or three.
describe("ledger notes line names its books (C206)", () => {
  it("names two or three books; one or four+ keep the number", () => {
    expect(notesAcrossLine({ notes: 3, highlights: 1, books: 2, titles: ["Placeholder Work One", "Placeholder Work Two"] }, true))
      .toBe("3 margin notes · 1 highlight across Placeholder Work One and Placeholder Work Two");
    expect(notesAcrossLine({ notes: 3, highlights: 0, books: 3, titles: ["A", "B", "C"] }, true)).toBe("3 margin notes across A, B and C");
    expect(notesAcrossLine({ notes: 1, highlights: 0, books: 1, titles: ["A"] }, true)).toBe("1 margin note across 1 book");
    expect(notesAcrossLine({ notes: 4, highlights: 0, books: 4, titles: ["A", "B", "C", "D"] }, true)).toBe("4 margin notes across 4 books");
  });
  it("keeps the number when titles don't match the count, or naming isn't asked for", () => {
    expect(bookNames({ notes: 2, highlights: 0, books: 2, titles: ["A"] })).toBeNull();
    expect(bookNames({ notes: 2, highlights: 0, books: 2 })).toBeNull();
    expect(notesAcrossLine({ notes: 2, highlights: 0, books: 2, titles: ["A", "B"] })).toBe("2 margin notes across 2 books");
  });
  it("preview totals carry titles in shelf order, only for books with notes", () => {
    const t = totalAnnotations(
      { one: [JSON.stringify({ notes: [1] })], two: [null], three: [JSON.stringify({ highlights: [1] })] },
      { one: "Placeholder Work One", two: "Placeholder Work Two", three: "Placeholder Work Three" },
    );
    expect(t).toEqual({ notes: 1, highlights: 1, books: 2, titles: ["Placeholder Work One", "Placeholder Work Three"], slugs: ["one", "three"] });
    expect(totalAnnotations({ one: [JSON.stringify({ notes: [1] })] })).toEqual({ notes: 1, highlights: 0, books: 1 });
  });
  it("library titles sort by series, series order, then title", () => {
    expect(annotatedTitles([
      { title: "Zed", series: "B", series_order: 1 },
      { title: "Second", series: "A", series_order: 2 },
      { title: "First", series: "A", series_order: 1 },
    ])).toEqual(["First", "Second", "Zed"]);
  });
  it("the ledger names; the card page keeps the number", () => {
    const totals = { notes: 2, highlights: 0, books: 2, titles: ["Placeholder Work One", "Placeholder Work Two"] };
    expect(renderToStaticMarkup(<NotesTally totals={totals} name />)).toContain("You have 2 margin notes across Placeholder Work One and Placeholder Work Two.");
    expect(renderToStaticMarkup(<NotesTally totals={totals} link />)).toContain("across 2 books");
    expect(readFileSync("app/ledger/page.tsx", "utf8")).toContain("<NotesTally totals={await myAnnotationTotals()} name />");
  });
  it("library totals ask the works table for titles only for two or three books", () => {
    const src = readFileSync("lib/ledgerStore.ts", "utf8");
    expect(src).toMatch(/books\.size >= 2 && books\.size <= 3/);
    expect(src).toContain('from("works").select("id, slug, title, series, series_order").in("id", [...books])');
  });
});
