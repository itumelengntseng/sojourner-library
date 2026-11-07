import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { borrowedTimesLine } from "@/lib/loanDesk";

const l = (workId: string, readerId = "me") => ({ workId, readerId });

describe("work page — You've borrowed this N times (C153)", () => {
  it("counts own loans of this work only, from the second loan", () => {
    expect(borrowedTimesLine([l("w")], "w", "me")).toBeNull();
    expect(borrowedTimesLine([], "w", "me")).toBeNull();
    expect(borrowedTimesLine([l("w"), l("w")], "w", "me")).toBe("You've borrowed this twice");
    expect(borrowedTimesLine([l("w"), l("w"), l("w"), l("x"), l("w", "you")], "w", "me")).toBe("You've borrowed this 3 times");
  });
  it("sits under the loan desk", () => {
    const src = readFileSync("app/works/[slug]/page.tsx", "utf8");
    expect(src).toContain("borrowedTimesLine(desk.loans, desk.workId, desk.readerId) && (");
    expect(src.indexOf("borrowedTimesLine(desk.loans")).toBeGreaterThan(src.indexOf("<LoanDesk desk={desk}"));
  });
});

describe("work page — first on <date> (C155)", () => {
  it("adds the earliest own loan's SA date", async () => {
    const { finishedDate } = await import("@/lib/ledger");
    const a = Date.parse("2026-11-04T23:30:00Z"); // 5 Nov in SA
    const b = Date.parse("2026-11-07T08:00:00Z");
    const line = borrowedTimesLine([{ workId: "w", readerId: "me", borrowedAt: b }, { workId: "w", readerId: "me", borrowedAt: a }, { workId: "w", readerId: "you", borrowedAt: 0 }], "w", "me");
    expect(line).toBe("You've borrowed this twice · first on 05 Nov 2026");
    expect(line).toContain(finishedDate(a));
  });
});
