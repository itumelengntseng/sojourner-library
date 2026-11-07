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
