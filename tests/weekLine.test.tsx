import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WeekLine } from "@/components/WeekLine";

describe("C60 this week on the card page", () => {
  it("time and days, with a link to the ledger", () => {
    const html = renderToStaticMarkup(<WeekLine week={{ ms: 35 * 60_000, days: 2 }} />);
    expect(html).toContain("This week: ");
    expect(html).toContain("35 min");
    expect(html).toContain(" on 2 days");
    expect(html).toContain('href="/ledger"');
    expect(renderToStaticMarkup(<WeekLine week={{ ms: 10 * 60_000, days: 1 }} />)).toContain(" on 1 day");
  });
  it("nothing read → says so; signed out → nothing", () => {
    expect(renderToStaticMarkup(<WeekLine week={{ ms: 0, days: 0 }} />)).toContain("Nothing read this week yet");
    expect(renderToStaticMarkup(<WeekLine week={null} />)).toBe("");
  });
});
