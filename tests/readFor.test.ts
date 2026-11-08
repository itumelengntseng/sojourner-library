import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readForLine } from "@/lib/ledger";

describe("work page — You've read for <time> in this book (C170)", () => {
  it("says the reader's own time, nothing when none", () => {
    expect(readForLine(45 * 60_000)).toBe("You've read for 45 min in this book");
    expect(readForLine(30_000)).toBe("You've read for under a minute in this book");
    expect(readForLine(0)).toBeNull();
    expect(readForLine(undefined)).toBeNull();
  });
  it("links to the ledger's Hours per book", () => {
    const src = readFileSync("app/works/[slug]/page.tsx", "utf8");
    expect(src).toContain('<Link href="/ledger#hours" className="underline underline-offset-2 hover:text-lamplight">{readFor}<span className="sr-only"> — see your hours per book</span></Link>');
  });
});
