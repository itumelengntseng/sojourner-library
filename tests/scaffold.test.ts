import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { AUTHOR } from "@/lib/site";

describe("app scaffold", () => {
  it("keeps the engine under lib/", () => {
    for (const f of ["readingTime", "checkout", "ask"]) expect(existsSync(`lib/engine/${f}.ts`)).toBe(true);
  });
  it("credits Itumeleng Ntseng", () => {
    expect(AUTHOR).toBe("Itumeleng Ntseng");
    expect(readFileSync("app/layout.tsx", "utf8")).toContain("{AUTHOR}");
  });
  it("is not indexed by search engines (private library)", () => {
    expect(readFileSync("app/layout.tsx", "utf8")).toMatch(/index:\s*false/);
  });
});
