import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { justBorrowed, onLoanNow } from "@/lib/loanDesk";
import { OnLoanNow } from "@/components/OnLoanNow";
import type { Loan } from "@/lib/engine/checkout";

const NOW = Date.parse("2026-11-07T10:00:00Z");
const M = 60_000;
const loan = (id: string, borrowedAgoMin: number): Loan => ({
  id, workId: id, readerId: "me", period: "two_weeks", borrowedAt: NOW - borrowedAgoMin * M, dueAt: NOW + 3 * 24 * 60 * M,
  returnedAt: null, renewals: 0, bookmark: { chapterIndex: 0, wordOffset: 0 },
});
const W = { a: { slug: "work-a", title: "Placeholder A" }, b: { slug: "work-b", title: "Placeholder B" } };

describe("card page — Just borrowed (C137)", () => {
  it("open loans carry their borrow time and stamp", () => {
    const [l] = onLoanNow([loan("a", 10)], "me", W, NOW);
    expect(l.borrowedAt).toBe(NOW - 10 * M);
    expect(l.borrowed).toMatch(/Sat, 07 Nov, 11:50/);
  });
  it("is true only within the hour after borrowing", () => {
    expect(justBorrowed({ borrowedAt: NOW - 59 * M }, NOW)).toBe(true);
    expect(justBorrowed({ borrowedAt: NOW - 60 * M }, NOW)).toBe(false);
    expect(justBorrowed({}, NOW)).toBe(false);
  });
  it("marks only the loan borrowed within the hour, spoken with its stamp", () => {
    const loans = onLoanNow([loan("a", 10), loan("b", 120)], "me", W, NOW);
    const html = renderToStaticMarkup(<OnLoanNow loans={loans} now={NOW} />);
    expect(html.match(/Just borrowed<\/span>/g)?.length).toBe(1);
    expect(html).toMatch(/<span aria-hidden="true">Just borrowed<\/span><span class="sr-only">Just borrowed, Sat, 07 Nov, 11:50<\/span>/);
    expect(renderToStaticMarkup(<OnLoanNow loans={loans} />)).not.toContain("Just borrowed");
    expect(readFileSync("app/card/page.tsx", "utf8")).toMatch(/<OnLoanNow [^>]*now=\{Date\.now\(\)\}/);
  });
});

describe("card page — N borrowed in the last hour (C148)", () => {
  const W3 = { ...W, c: { slug: "work-c", title: "Placeholder C" } };
  it("says how many with two or more taken out within the hour", () => {
    const html = renderToStaticMarkup(<OnLoanNow loans={onLoanNow([loan("a", 10), loan("b", 30), loan("c", 120)], "me", W3, NOW)} now={NOW} />);
    expect(html).toContain('<p class="mt-1 font-sans text-xs text-lamplight">2 borrowed in the last hour</p>');
  });
  it("says nothing for one, or without the clock", () => {
    const loans = onLoanNow([loan("a", 10), loan("c", 120)], "me", W3, NOW);
    expect(renderToStaticMarkup(<OnLoanNow loans={loans} now={NOW} />)).not.toContain("borrowed in the last hour");
    expect(renderToStaticMarkup(<OnLoanNow loans={onLoanNow([loan("a", 10), loan("b", 30)], "me", W3, NOW)} />)).not.toContain("borrowed in the last hour");
  });
});
