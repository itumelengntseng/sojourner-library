import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { YourNotes } from "@/components/YourNotes";
import { annotationLine, countAnnotations } from "@/lib/notesCount";

describe("your notes in this book (C43)", () => {
  it("counts preview annotations across chapters, skipping damaged entries", () => {
    const ch1 = JSON.stringify({ notes: [{ id: "n1" }, { id: "n2" }], highlights: [{ id: "h1" }] });
    const ch2 = JSON.stringify({ notes: [], highlights: [{ id: "h2" }] });
    expect(countAnnotations([ch1, null, ch2, "{broken", JSON.stringify({ notes: "nope" })])).toEqual({ notes: 2, highlights: 2 });
    expect(countAnnotations([])).toEqual({ notes: 0, highlights: 0 });
  });
  it("words the line, or nothing when there are none", () => {
    expect(annotationLine({ notes: 2, highlights: 1 })).toBe("2 margin notes and 1 highlight");
    expect(annotationLine({ notes: 1, highlights: 0 })).toBe("1 margin note");
    expect(annotationLine({ notes: 0, highlights: 3 })).toBe("3 highlights");
    expect(annotationLine({ notes: 0, highlights: 0 })).toBeNull();
  });
  it("library mode: shows the count and the per-book notes download", () => {
    const html = renderToStaticMarkup(<YourNotes slug="w1" title="Placeholder Work One" positions={[1, 2]} counts={{ notes: 2, highlights: 1 }} />);
    expect(html).toContain("You have 2 margin notes and 1 highlight in this book");
    expect(html).toContain('href="/ledger/notes?work=w1"');
    expect(renderToStaticMarkup(<YourNotes slug="w1" title="T" positions={[1]} counts={{ notes: 0, highlights: 0 }} />)).toBe("");
  });
  it("preview mode renders nothing on the server (the browser counts after load)", () => {
    expect(renderToStaticMarkup(<YourNotes slug="w1" title="T" positions={[1]} counts={null} />)).toBe("");
  });
});

describe("all your notes link (C182)", () => {
  it("library mode: links to the ledger's notes once two or more books have notes", () => {
    const two = renderToStaticMarkup(<YourNotes slug="w1" title="T" positions={[1]} counts={{ notes: 1, highlights: 0 }} books={2} />);
    expect(two).toContain('href="/ledger#export"');
    expect(two).toContain("all your notes<span class=\"sr-only\"> — in your ledger</span>");
    expect(renderToStaticMarkup(<YourNotes slug="w1" title="T" positions={[1]} counts={{ notes: 1, highlights: 0 }} books={1} />)).not.toContain("/ledger#export");
    expect(renderToStaticMarkup(<YourNotes slug="w1" title="T" positions={[1]} counts={{ notes: 1, highlights: 0 }} />)).not.toContain("/ledger#export");
  });
  it("the work page passes the library totals", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("app/works/[slug]/page.tsx", "utf8")).toContain("books={noteTotals?.books ?? null} />");
  });
});
