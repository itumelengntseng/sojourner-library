import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JustReturnedNote } from "@/components/JustReturnedNote";
import type { Returned } from "@/lib/loanDesk";

const NOW = Date.parse("2026-11-07T10:00:00Z");
const M = 60_000;
const item = (slug: string, agoMin: number, onTime = true): Returned => ({
  workKey: slug, slug, title: `Placeholder ${slug}`, borrowed: "Fri, 06 Nov, 09:00", returned: "Sat, 07 Nov, 11:40", returnedAt: NOW - agoMin * M, onTime,
});

describe("front hall — Just returned note (C131)", () => {
  it("names the book handed back within the hour and links to its desk", () => {
    const html = renderToStaticMarkup(<JustReturnedNote items={[item("a", 10), item("b", 30)]} now={NOW} />);
    expect(html).toContain('<span aria-hidden="true" class="text-lamplight">Just returned</span><span class="sr-only">Just returned, Sat, 07 Nov, 11:40:</span>');
    expect(html).toContain("Placeholder a");
    expect(html).not.toContain("Placeholder b");
    expect(html).toContain('href="/works/a#desk"');
  });
  it("says nothing after the hour or for a loan that ran out", () => {
    expect(renderToStaticMarkup(<JustReturnedNote items={[item("a", 61)]} now={NOW} />)).toBe("");
    expect(renderToStaticMarkup(<JustReturnedNote items={[item("a", 5, false)]} now={NOW} />)).toBe("");
    expect(renderToStaticMarkup(<JustReturnedNote items={[]} now={NOW} />)).toBe("");
  });
  it("the front hall shows it only when there's no Continue reading card", () => {
    const src = readFileSync("app/page.tsx", "utf8");
    expect(src).toContain("const returned = cont ? [] : await myRecentlyReturned();");
    expect(src).toContain("{!cont && <JustReturnedNote items={returned} now={now} />}");
  });
});
