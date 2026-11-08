import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ledger Most hours — order the halls the same way (C166)", () => {
  it("links to /halls?sort=read only under the Most hours order", () => {
    const src = readFileSync("app/ledger/page.tsx", "utf8");
    expect(src).toContain('{hoursOrder === "most" && <Link href="/halls?sort=read" className="text-sandstone/80 underline underline-offset-2 hover:text-lamplight">Order the halls the same way</Link>}');
  });
});

describe("ledger Most hours — the top row's most read mark (C169)", () => {
  it("marks only the first row under Most hours, with two or more books", () => {
    const src = readFileSync("app/ledger/page.tsx", "utf8");
    expect(src).toContain('{hoursOrder === "most" && i === 0 && l.hours.length > 1 && h.activeMs > 0 && (');
    expect(src).toContain('<span aria-hidden="true">most read</span><span className="sr-only">your most-read book</span>');
  });
});
