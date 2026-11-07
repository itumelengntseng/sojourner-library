import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("work page: On loan to you · due … under the title (C121)", () => {
  const src = readFileSync("app/works/[slug]/page.tsx", "utf8");
  it("shows only with an open loan, stamped on the slip's clock, linking to the desk", () => {
    expect(src).toContain("{openNow && (");
    expect(src).toContain('<Link href="#desk" className="underline underline-offset-2 hover:text-lamplight">{justBorrowed(openNow, now)');
    expect(src).toContain('On loan to you · due {stampDate(openNow.dueAt)}</Link>');
    expect(src.indexOf("On loan to you · due")).toBeLessThan(src.indexOf('<h2 id="desk"'));
  });
});
