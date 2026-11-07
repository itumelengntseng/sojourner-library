import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("halls: a legend for the due-soon band (C103)", () => {
  const src = readFileSync("app/halls/page.tsx", "utf8");
  it("explains the band and points to the front desk", () => {
    expect(src).toContain("marks books due back within the day — renew them at the");
  });
  it("is shown only when a due-soon band shows (a book out to the reader and due within the day)", () => {
    const legend = src.indexOf("marks books due back within the day");
    const guard = src.lastIndexOf("works.some((w) => out[w.slug] && soon.has(w.slug))", legend);
    expect(guard).toBeGreaterThan(0);
    expect(legend - guard).toBeLessThan(400);
    // the band itself uses the same condition
    expect(src).toContain("{loan && soon.has(w.slug) && <span");
  });
});

describe("halls: the out legend says how many (C118) and how many are fresh (C150)", () => {
  const src = readFileSync("app/halls/page.tsx", "utf8");
  it("counts the books out to the reader on the shelves shown, and the ones taken out within the hour", () => {
    expect(src).toContain("marks {outLegend(works.filter((w) => out[w.slug]).length, works.filter((w) => out[w.slug] && justBorrowed(out[w.slug], nowMs)).length)} at the <Link");
  });
  it("words singular, plural and fresh loans", async () => {
    const { outLegend } = await import("@/lib/spine");
    expect(outLegend(1)).toBe("the book out to you — renew or return it");
    expect(outLegend(2)).toBe("the 2 books out to you — renew or return them");
    expect(outLegend(1, 1)).toBe("the book out to you (just borrowed) — renew or return it");
    expect(outLegend(3, 1)).toBe("the 3 books out to you (1 just borrowed) — renew or return them");
  });
});
