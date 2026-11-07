import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { spokenSpine } from "@/lib/spine";

const base = { author: "Itumeleng Ntseng", canon: "Canon", readingTime: "1 h 10 min" };

describe("halls spine — just borrowed (C144)", () => {
  it("says it after the loan line, with the borrow stamp", () => {
    expect(spokenSpine({ ...base, due: "Sat, 07 Nov, 14:00", justBorrowed: "Sat, 07 Nov, 13:10" }))
      .toBe("by Itumeleng Ntseng. Canon. 1 h 10 min to read. On loan to you, due Sat, 07 Nov, 14:00. Just borrowed, Sat, 07 Nov, 13:10.");
  });
  it("says nothing without a loan, or without the stamp", () => {
    expect(spokenSpine({ ...base, justBorrowed: "Sat, 07 Nov, 13:10" })).not.toContain("Just borrowed");
    expect(spokenSpine({ ...base, due: "Sat, 07 Nov, 14:00" })).not.toContain("Just borrowed");
  });
  it("the halls pass the stamp only for a loan taken out within the hour", () => {
    expect(readFileSync("app/halls/page.tsx", "utf8")).toContain("justBorrowed: loan && justBorrowed(loan, nowMs) ? loan.borrowed : undefined");
  });
});
