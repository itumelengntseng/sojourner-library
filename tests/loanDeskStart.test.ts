import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("work page loan desk — Start reading (C149)", () => {
  const src = readFileSync("components/LoanDesk.tsx", "utf8");
  it("a fresh loan starts, spoken with the title; a bookmarked one resumes", () => {
    expect(src).toContain('{open.bookmark.wordOffset > 0 ? "Resume at your bookmark" : <>Start reading<span className="sr-only">: {title}</span></>}');
    expect(src).not.toContain("Open the reading room");
  });
  it("the QA sweep and the e2e script look for the new words", () => {
    expect(readFileSync("scripts/qa.mjs", "utf8")).toContain('getByRole("link", { name: /^Start reading/ })');
    expect(readFileSync("scripts/e2e.mjs", "utf8")).toContain("/Start reading|Open the reading room|Resume at your bookmark/");
  });
});
