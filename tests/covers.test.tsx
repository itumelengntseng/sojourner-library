import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { getWorks, PLACEHOLDER_WORKS, seedOf } from "@/lib/catalogue";
import { SceneCover } from "@/components/SceneCover";

describe("placeholder catalogue", () => {
  it("credits Itumeleng Ntseng on every work", () => {
    for (const w of getWorks()) expect(w.author).toBe("Itumeleng Ntseng");
  });
  it("marks every work as a placeholder until manuscripts arrive", () => {
    for (const w of PLACEHOLDER_WORKS) {
      expect(w.isPlaceholder).toBe(true);
      expect(w.title).toMatch(/^Placeholder/);
      for (const c of w.chapters) expect(c.body).toMatch(/^Placeholder text/);
    }
  });
  it("has unique slugs", () => {
    const slugs = getWorks().map((w) => w.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("seeds cover palettes deterministically", () => {
    expect(seedOf("abc")).toBe(seedOf("abc"));
    expect(seedOf("abc")).toBeGreaterThanOrEqual(0);
    expect(seedOf("abc")).toBeLessThan(360);
  });
});

describe("SceneCover", () => {
  const work = getWorks()[0];
  const html = renderToStaticMarkup(<SceneCover work={work} />);
  it("layers the Harlem street and Free State plains scenes", () => {
    expect(html).toContain("scene-harlem");
    expect(html).toContain("scene-plains");
  });
  it("names the work and author for screen readers", () => {
    expect(html).toContain(`aria-label="Cover of ${work.title} by Itumeleng Ntseng"`);
  });
  it("shows the author and the placeholder badge", () => {
    expect(html).toContain(">Itumeleng Ntseng<");
    expect(html).toContain(">Placeholder<");
  });
  it("uses gradient ids unique to the work", () => {
    expect(html).toContain(`id="dusk-${work.slug}"`);
  });
  it("holds still for readers who prefer reduced motion", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*scene-cover[\s\S]*animation: none/);
  });
});
