import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NotesTally } from "@/components/NotesTally";
import { annotatedBooks, namedBookLinks } from "@/lib/notesCount";

// C212: the ledger's named books link to their work pages; the count form stays plain.
describe("named books link to their work pages (C212)", () => {
  const two = { notes: 2, highlights: 1, books: 2, titles: ["Placeholder Work One", "Placeholder Work Two"], slugs: ["placeholder-work-one", "placeholder-work-two"] };
  it("links each named title, joined as the words are", () => {
    const html = renderToStaticMarkup(<NotesTally totals={two} name />);
    expect(html).toContain("You have 2 margin notes · 1 highlight across ");
    expect(html).toContain('<a class="text-lamplight underline underline-offset-2 hover:text-ember" href="/works/placeholder-work-one">Placeholder Work One</a>');
    expect(html).toContain(' and <a class="text-lamplight underline underline-offset-2 hover:text-ember" href="/works/placeholder-work-two">Placeholder Work Two</a>');
    const three = renderToStaticMarkup(<NotesTally totals={{ notes: 3, highlights: 0, books: 3, titles: ["A", "B", "C"], slugs: ["a", "b", "c"] }} name />);
    expect(three.replace(/<[^>]+>/g, "")).toBe("You have 3 margin notes across A, B and C.");
  });
  it("stays plain when counted, without slugs, or on the card page", () => {
    expect(namedBookLinks({ notes: 4, highlights: 0, books: 4, titles: ["A", "B", "C", "D"], slugs: ["a", "b", "c", "d"] })).toBeNull();
    expect(namedBookLinks({ notes: 2, highlights: 0, books: 2, titles: ["A", "B"] })).toBeNull();
    expect(renderToStaticMarkup(<NotesTally totals={{ notes: 1, highlights: 0, books: 1, titles: ["A"], slugs: ["a"] }} name />)).not.toContain("href=");
    expect(renderToStaticMarkup(<NotesTally totals={two} link />)).not.toContain('href="/works/');
  });
  it("library rows keep title and slug together in shelf order", () => {
    expect(annotatedBooks([{ title: "B", slug: "b", series_order: 2 }, { title: "A", slug: "a", series_order: 1 }])).toEqual([{ title: "A", slug: "a" }, { title: "B", slug: "b" }]);
  });
});
