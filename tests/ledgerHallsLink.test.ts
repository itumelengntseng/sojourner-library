import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ledger Most hours — order the halls the same way (C166)", () => {
  it("links to /halls?sort=read only under the Most hours order", () => {
    const src = readFileSync("app/ledger/page.tsx", "utf8");
    expect(src).toContain('{hoursOrder === "most" && <Link href="/halls?sort=read" className="text-sandstone/80 underline underline-offset-2 hover:text-lamplight">Order the halls the same way</Link>}');
  });
});
