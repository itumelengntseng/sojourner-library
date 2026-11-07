import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { justReturned, type Returned } from "@/lib/loanDesk";
import { RecentlyReturned } from "@/components/RecentlyReturned";

const NOW = Date.parse("2026-11-07T10:00:00Z");
const M = 60_000;
const item = (returnedAgoMin: number, onTime = true): Returned => ({
  workKey: "w1", slug: "work-a", title: "Placeholder A", borrowed: "Fri, 06 Nov, 09:00", returned: "Sat, 07 Nov, 11:40",
  returnedAt: NOW - returnedAgoMin * M, onTime,
});

describe("card page — Just returned (C124)", () => {
  it("is true only within the hour after the reader handed it back", () => {
    expect(justReturned(item(0), NOW)).toBe(true);
    expect(justReturned(item(59), NOW)).toBe(true);
    expect(justReturned(item(60), NOW)).toBe(false);
    expect(justReturned(item(5, false), NOW)).toBe(false); // an expired loan the desk settled
  });
  it("shows 'Just returned' instead of the stamp, keeping the stamp in the spoken label", () => {
    const html = renderToStaticMarkup(<RecentlyReturned items={[item(10)]} now={NOW} />);
    expect(html).toMatch(/<span aria-hidden="true"[^>]*>Just returned<\/span><span class="sr-only">Just returned, Sat, 07 Nov, 11:40<\/span>/);
    expect(html).not.toMatch(/returned<!-- --> <!-- -->Sat/);
  });
  it("keeps the stamp after the hour, for expired loans, and when no time is given", () => {
    for (const html of [
      renderToStaticMarkup(<RecentlyReturned items={[item(90)]} now={NOW} />),
      renderToStaticMarkup(<RecentlyReturned items={[item(10)]} />),
    ]) {
      expect(html).not.toMatch(/Just returned/);
      expect(html).toMatch(/returned.*Sat, 07 Nov, 11:40/);
    }
    const late = renderToStaticMarkup(<RecentlyReturned items={[item(10, false)]} now={NOW} />);
    expect(late).toMatch(/back on the shelf when due/);
    expect(late).not.toMatch(/Just returned/);
  });
  it("the card page passes the current time", () => {
    expect(readFileSync("app/card/page.tsx", "utf8")).toMatch(/<RecentlyReturned [^>]*now=\{Date\.now\(\)\}/);
  });
});

describe("card page — Recently returned count (C126)", () => {
  it("carries the count with two or more lines, plain with one", () => {
    const one = renderToStaticMarkup(<RecentlyReturned items={[item(90)]} now={NOW} />);
    expect(one).toMatch(/>Recently returned<\/h2>/);
    const two = renderToStaticMarkup(<RecentlyReturned items={[item(90), { ...item(200), workKey: "w2", slug: "work-b" }, { ...item(300), workKey: "w3", slug: "work-c" }]} now={NOW} />);
    expect(two).toMatch(/>Recently returned · 3<\/h2>/);
  });
});
