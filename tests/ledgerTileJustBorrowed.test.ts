import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { justBorrowedNote } from "@/lib/loanDesk";

const NOW = Date.parse("2026-11-07T10:00:00Z");
const M = 60_000;

describe("ledger On loan tile — just borrowed (C146)", () => {
  it("counts loans taken out within the hour", () => {
    expect(justBorrowedNote([{ borrowedAt: NOW - 5 * M }, { borrowedAt: NOW - 30 * M }, { borrowedAt: NOW - 90 * M }], NOW)).toBe(" · 2 just borrowed");
    expect(justBorrowedNote([{ borrowedAt: NOW - 90 * M }, {}], NOW)).toBe("");
  });
  it("follows the due part of the tile's note", () => {
    const src = readFileSync("app/ledger/page.tsx", "utf8");
    expect(src).toContain("note: (dueBackSoon(open, now).length ? `due back within the day · ${open[0].due}` : `next due ${open[0].due}`) + justBorrowedNote(open, now), href: \"/card\"");
  });
});
