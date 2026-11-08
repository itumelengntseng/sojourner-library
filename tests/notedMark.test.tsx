import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NotedMark } from "@/components/NotedMark";

// C198: the work page's chapter list marks chapters holding the reader's own notes.
describe("noted mark (C198)", () => {
  it("shows a quiet mark, spoken 'you have notes here', when the server says so", () => {
    const html = renderToStaticMarkup(<NotedMark noted slug="w" position={1} />);
    expect(html).toContain(">noted</span>");
    expect(html).toContain("you have notes here");
  });
  it("nothing when the chapter holds none; preview counts after load", () => {
    expect(renderToStaticMarkup(<NotedMark noted={false} slug="w" position={1} />)).toBe("");
    expect(renderToStaticMarkup(<NotedMark noted={null} slug="w" position={1} />)).toBe("");
  });
  it("the work page passes own counts per chapter", () => {
    const src = readFileSync("app/works/[slug]/page.tsx", "utf8");
    expect(src).toContain("myAnnotationsByChapter(work.slug)");
    expect(src).toContain("<NotedMark noted={byChapter ? !!byChapter[c.position] : null} slug={work.slug} position={c.position} href={out ? `/works/${work.slug}/read?ch=${c.position}` : undefined} chapter={c.title} />");
  });
});

describe("noted mark link (C201)", () => {
  it("while the book is out, opens that chapter in the reading room, spoken with the chapter's title", () => {
    const html = renderToStaticMarkup(<NotedMark noted slug="w" position={3} href="/works/w/read?ch=3" chapter="Placeholder chapter 3" />);
    expect(html).toContain('href="/works/w/read?ch=3"');
    expect(html).toContain("open your notes in Placeholder chapter 3");
    expect(html).not.toContain("you have notes here");
  });
  it("a plain mark otherwise, and no link when there are no notes", () => {
    expect(renderToStaticMarkup(<NotedMark noted slug="w" position={3} />)).not.toContain("href=");
    expect(renderToStaticMarkup(<NotedMark noted={false} slug="w" position={3} href="/works/w/read?ch=3" chapter="x" />)).toBe("");
  });
});
