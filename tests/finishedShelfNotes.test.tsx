import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FinishedShelf } from "@/components/FinishedShelf";

// C89: each book on the ledger's Read to the end shelf offers "Notes for this book" (own notes only).
const items = [{ workKey: "id-1", finishedAt: 2 }, { workKey: "gone", finishedAt: 1 }];
const title = (k: string) => (k === "id-1" ? "Placeholder Work One" : "A work no longer on the shelves");
const slug = (k: string) => (k === "id-1" ? "placeholder-work-one" : null);

describe("Notes for this book on Read to the end (C89)", () => {
  it("links the library route for books whose slug is known, naming the book", () => {
    const html = renderToStaticMarkup(<FinishedShelf items={items} title={title} href={() => null} slug={slug} />);
    expect(html.match(/Notes for this book/g)).toHaveLength(1);
    expect(html).toContain('href="/ledger/notes?work=placeholder-work-one"');
    expect(html).toContain('<span class="sr-only">: Placeholder Work One</span>');
  });
  it("in preview mode it is the in-browser download button", () => {
    const html = renderToStaticMarkup(<FinishedShelf items={items} title={title} href={() => null} slug={slug} notes="preview" />);
    expect(html).toMatch(/<button[^>]*>Notes for this book<span class="sr-only">: Placeholder Work One<\/span><\/button>/);
    expect(html).not.toContain("/ledger/notes");
  });
  it("without slugs it shows no notes link (as before)", () => {
    expect(renderToStaticMarkup(<FinishedShelf items={items} title={title} href={() => null} />)).not.toContain("Notes for this book");
  });
});
