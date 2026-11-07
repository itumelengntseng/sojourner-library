import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FrontHallSearch } from "@/components/FrontHallSearch";

describe("C53 front hall search", () => {
  it("is a labelled GET form to the halls with a q field", () => {
    const html = renderToStaticMarkup(<FrontHallSearch />);
    expect(html).toContain('role="search"');
    expect(html).toContain('action="/halls"');
    expect(html).toContain('method="get"');
    expect(html).toContain('name="q"');
    expect(html).toMatch(/<label[^>]*for="front-q"[^>]*>Search the shelves<\/label>/);
    expect(html).toContain('maxLength="80"');
  });
});
