import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NotesTally } from "@/components/NotesTally";

// C203: the card page says how many notes the reader has across the library, with the way to them.
describe("card page notes line (C203)", () => {
  it("links to the ledger's notes from the card page", () => {
    const html = renderToStaticMarkup(<NotesTally totals={{ notes: 3, highlights: 1, books: 2 }} link />);
    expect(html).toContain("You have 3 margin notes · 1 highlight across 2 books · ");
    expect(html).toContain('href="/ledger#export"');
    expect(html).toContain("see them in the ledger");
  });
  it("the ledger's own line stays unlinked; nothing when there are none", () => {
    expect(renderToStaticMarkup(<NotesTally totals={{ notes: 3, highlights: 1, books: 2 }} />)).not.toContain("href=");
    expect(renderToStaticMarkup(<NotesTally totals={{ notes: 0, highlights: 0, books: 0 }} link />)).toBe("");
    expect(renderToStaticMarkup(<NotesTally totals={null} link />)).toBe("");
  });
  it("both card pages (preview and signed in) show it", () => {
    expect(readFileSync("app/card/page.tsx", "utf8").match(/<NotesTally totals={await myAnnotationTotals\(\)} link \/>/g)).toHaveLength(2);
  });
});
