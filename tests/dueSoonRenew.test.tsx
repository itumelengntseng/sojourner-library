import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DueSoonSlip } from "@/components/DueSoonSlip";
import type { OnLoan } from "@/lib/loanDesk";

const on = (slug: string): OnLoan => ({ workKey: slug, slug, title: `Placeholder ${slug}`, due: "SAT 7 NOV, 14:00", timeLeft: "3 h", dueSoon: true, resume: false, dueAt: 0, bookmark: 0 });

describe("Renew on the front hall's Due back soon slip (C101)", () => {
  it("each line links to its work's loan desk, naming the book for screen readers", () => {
    const html = renderToStaticMarkup(<DueSoonSlip loans={[on("one"), on("two")]} />);
    expect(html.match(/>Renew<span/g)).toHaveLength(2);
    expect(html).toContain('href="/works/one#desk"');
    expect(html).toContain('href="/works/two#desk"');
    expect(html).toContain('<span class="sr-only"> Placeholder two at the loan desk</span>');
    expect(html).toContain('href="/works/one/read"');
  });
  it("nothing due → nothing shown", () => {
    expect(renderToStaticMarkup(<DueSoonSlip loans={[]} />)).toBe("");
  });
});

describe("No renewals left on the slip (C105)", () => {
  it("a loan with every renewal used says so instead of Renew", () => {
    const html = renderToStaticMarkup(<DueSoonSlip loans={[{ ...on("spent"), renewalsLeft: 0 }, { ...on("fresh"), renewalsLeft: 1 }]} />);
    expect(html).toContain("no renewals left");
    expect(html).not.toContain('href="/works/spent#desk"');
    expect(html).toContain('href="/works/fresh#desk"');
  });
});

describe("count on the Due back soon slip (C119)", () => {
  it("shows the count only with two or more lines", () => {
    expect(renderToStaticMarkup(<DueSoonSlip loans={[on("one"), on("two")]} />).replace(/<!-- -->/g, "")).toContain(">Due back soon · 2</h2>");
    expect(renderToStaticMarkup(<DueSoonSlip loans={[on("one")]} />).replace(/<!-- -->/g, "")).toContain(">Due back soon</h2>");
  });
});
