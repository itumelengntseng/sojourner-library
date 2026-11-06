import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/works/[slug]/actions", () => ({ deskAction: async () => ({ ok: false, message: "" }) }));

const { BorrowForm, rememberedPeriod } = await import("@/app/works/[slug]/LoanDeskForms");
const { PERIODS } = await import("@/lib/loanDesk");

describe("borrow form remembers the period (C44)", () => {
  const ids = PERIODS.map((p) => p.id);
  it("uses the stored period only when it's a real one on offer", () => {
    expect(rememberedPeriod("two_weeks", ids, "evening")).toBe("two_weeks");
    expect(rememberedPeriod("hour", ids, "evening")).toBe("hour");
    expect(rememberedPeriod(null, ids, "evening")).toBe("evening");
    expect(rememberedPeriod("forever", ids, "evening")).toBe("evening");
    expect(rememberedPeriod("hour", ["evening"], "evening")).toBe("evening");
  });
  it("starts on an evening before the browser has said otherwise", () => {
    const html = renderToStaticMarkup(<BorrowForm slug="w" periods={PERIODS} />);
    expect(html).toMatch(/checked="" value="evening"/);
    expect((html.match(/checked=""/g) ?? []).length).toBe(1);
  });
});
