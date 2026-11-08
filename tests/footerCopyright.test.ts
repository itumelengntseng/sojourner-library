import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUTHOR, COPYRIGHT } from "@/lib/site";

// C220: every page's footer names the author and carries "© Itumeleng Ntseng".
describe("footer copyright (C220)", () => {
  it("the copyright line is the author's", () => {
    expect(AUTHOR).toBe("Itumeleng Ntseng");
    expect(COPYRIGHT).toBe("© Itumeleng Ntseng");
  });
  it("the root layout (wrapping every page) prints it beside 'All works by'", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");
    expect(layout).toContain("All works by {AUTHOR} · <span>{COPYRIGHT}</span>");
  });
  it("the QA sweep checks it on every route", () => {
    expect(readFileSync("scripts/qa.mjs", "utf8")).toContain("footer without '© Itumeleng Ntseng'");
  });
});
