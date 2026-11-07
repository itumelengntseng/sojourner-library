import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hoursHref, orderHours, parseHoursOrder } from "@/lib/ledger";

const rows = [
  { workKey: "a", activeMs: 10, lastRead: 300 },
  { workKey: "b", activeMs: 90, lastRead: 100 },
  { workKey: "c", activeMs: 90, lastRead: 200 },
];

describe("ledger Hours per book — order toggle (C157)", () => {
  it("defaults to recently read; 'most' puts most time first (ties: most recent)", () => {
    expect(parseHoursOrder(undefined)).toBe("recent");
    expect(parseHoursOrder("junk")).toBe("recent");
    expect(parseHoursOrder("most")).toBe("most");
    expect(orderHours(rows, "recent").map((r) => r.workKey)).toEqual(["a", "c", "b"]);
    expect(orderHours(rows, "most").map((r) => r.workKey)).toEqual(["c", "b", "a"]);
  });
  it("links keep the Borrowing history choice and land on the table", () => {
    expect(hoursHref("recent", false)).toBe("/ledger#hours");
    expect(hoursHref("most", false)).toBe("/ledger?hours=most#hours");
    expect(hoursHref("most", true)).toBe("/ledger?hours=most&history=all#hours");
  });
  it("the ledger shows the toggle with two or more books and orders the table by it", () => {
    const src = readFileSync("app/ledger/page.tsx", "utf8");
    expect(src).toContain('<nav aria-label="Order hours per book"');
    expect(src).toContain("{orderHours(l.hours, hoursOrder).map((h) => (");
  });
});

describe("ledger Borrowing history links keep the hours order (C158)", () => {
  it("builds the links with or without the Most hours order", async () => {
    const { historyHref } = await import("@/lib/ledger");
    expect(historyHref(true, "recent")).toBe("/ledger?history=all#history");
    expect(historyHref(false, "recent")).toBe("/ledger#history");
    expect(historyHref(true, "most")).toBe("/ledger?hours=most&history=all#history");
    expect(historyHref(false, "most")).toBe("/ledger?hours=most#history");
  });
  it("the ledger uses them", () => {
    const src = readFileSync("app/ledger/page.tsx", "utf8");
    expect(src).toContain("<Link href={historyHref(true, hoursOrder)}");
    expect(src).toContain("<Link href={historyHref(false, hoursOrder)}");
  });
});
