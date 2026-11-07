import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecentlyReturned } from "@/components/RecentlyReturned";
import type { Returned } from "@/lib/loanDesk";

// C84: finished books in Recently returned offer "Notes for this book" (own notes only — the C29 export).
const item = (slug: string, title: string): Returned => ({ workKey: slug, slug, title, borrowed: "1 NOV 2026", returned: "5 NOV 2026", returnedAt: 1, onTime: true });
const items = [item("placeholder-work-one", "Placeholder Work One"), item("placeholder-work-two", "Placeholder Work Two")];

describe("Notes for this book on Recently returned (C84)", () => {
  it("links the library route for finished books only, naming the book for screen readers", () => {
    const html = renderToStaticMarkup(<RecentlyReturned items={items} finished={{ "placeholder-work-one": 5 }} notes="library" />);
    expect(html.match(/Notes for this book/g)).toHaveLength(1);
    expect(html).toContain('href="/ledger/notes?work=placeholder-work-one"');
    expect(html).toContain('<span class="sr-only">: Placeholder Work One</span>');
    expect(html).not.toContain("work=placeholder-work-two");
    // The link sits on the finished book's row, before the next book.
    expect(html.indexOf("Notes for this book")).toBeLessThan(html.indexOf("Placeholder Work Two"));
  });
  it("in preview mode offers the in-browser download button instead of a route", () => {
    const html = renderToStaticMarkup(<RecentlyReturned items={items} finished={{ "placeholder-work-two": 5 }} />);
    expect(html).toMatch(/<button[^>]*>Notes for this book<span class="sr-only">: Placeholder Work Two<\/span><\/button>/);
    expect(html).not.toContain("/ledger/notes");
  });
  it("shows no notes link when nothing returned was read to the end", () => {
    expect(renderToStaticMarkup(<RecentlyReturned items={items} notes="library" />)).not.toContain("Notes for this book");
  });
  it("keeps the slug safe in the link", () => {
    const html = renderToStaticMarkup(<RecentlyReturned items={[item("a b&c", "Placeholder")]} finished={{ "a b&c": 1 }} notes="library" />);
    expect(html).toContain("work=a%20b%26c");
  });
});
