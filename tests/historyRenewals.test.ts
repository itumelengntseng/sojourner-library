import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renewalsLeftLine } from "@/lib/ledger";

describe("ledger Borrowing history: renewals left on an open loan (C109)", () => {
  it("counts down to none, and says nothing for a closed loan", () => {
    expect(renewalsLeftLine({ open: true, renewals: 0 })).toBe("3 renewals left");
    expect(renewalsLeftLine({ open: true, renewals: 2 })).toBe("1 renewal left");
    expect(renewalsLeftLine({ open: true, renewals: 3 })).toBe("No renewals left");
    expect(renewalsLeftLine({ open: false, renewals: 1 })).toBe("");
  });
  it("the ledger shows it only on open rows", () => {
    expect(readFileSync("app/ledger/page.tsx", "utf8")).toContain("{r.open ? ` · ${renewalsLeftLine(r).toLowerCase()}` : \"\"}");
  });
});
