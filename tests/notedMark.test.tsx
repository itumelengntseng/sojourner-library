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
    expect(src).toContain("<NotedMark noted={byChapter ? !!byChapter[c.position] : null} slug={work.slug} position={c.position} />");
  });
});
