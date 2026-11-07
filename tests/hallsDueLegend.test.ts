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
