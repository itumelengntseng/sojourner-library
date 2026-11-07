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
