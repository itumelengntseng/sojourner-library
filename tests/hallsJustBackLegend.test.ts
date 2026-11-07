import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { justBackLegend } from "@/lib/spine";

describe("halls legend for the lamplight ✓ (C142)", () => {
  it("words one book and several", () => {
    expect(justBackLegend(1)).toBe("a book you returned in the last hour — borrow it again any time.");
    expect(justBackLegend(2)).toBe("the 2 books you returned in the last hour — borrow them again any time.");
  });
  it("shows only when a ✓ shows (handed back within the hour, not out again), before the read key", () => {
    const src = readFileSync("app/halls/page.tsx", "utf8");
    expect(src).toContain("{works.some((w) => !out[w.slug] && backNow[w.slug]) && (");
    expect(src).toContain("marks {justBackLegend(works.filter((w) => !out[w.slug] && backNow[w.slug]).length)}");
    expect(src).toContain('{!loan && backNow[w.slug] && <span aria-hidden="true" title="Just returned"');
    expect(src.indexOf("justBackLegend(works")).toBeLessThan(src.indexOf("read to the end</Link>"));
  });
});
