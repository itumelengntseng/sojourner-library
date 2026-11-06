import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShelfEmpty } from "@/components/ShelfEmpty";

describe("empty shelves", () => {
  it("sends signed-out visitors to the front desk in library mode", () => {
    const html = renderToStaticMarkup(<ShelfEmpty catalogue={{ mode: "library", signedIn: false }} />);
    expect(html).toContain('href="/card"');
    expect(html).toMatch(/card holders/);
  });
  it("says plainly when nothing is shared yet", () => {
    expect(renderToStaticMarkup(<ShelfEmpty catalogue={{ mode: "library", signedIn: true }} />)).toMatch(/Nothing has been shelved/);
  });
});
