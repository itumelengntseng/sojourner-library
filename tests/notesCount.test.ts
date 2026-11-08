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
