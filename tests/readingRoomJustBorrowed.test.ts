import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { showJustBorrowed } from "@/components/JustBorrowedLine";

const NOW = Date.parse("2026-11-07T10:00:00Z");
const M = 60_000;

describe("reading room — Just borrowed line (C147)", () => {
  it("shows on a loan taken out within the hour with no bookmark yet", () => {
    expect(showJustBorrowed({ borrowedAt: NOW - 10 * M, dueAt: NOW + 4 * 60 * M, hasBookmark: false }, NOW)).toBe(true);
  });
  it("gives way to a bookmark, an older loan, and the due-within-the-hour line", () => {
    expect(showJustBorrowed({ borrowedAt: NOW - 10 * M, dueAt: NOW + 4 * 60 * M, hasBookmark: true }, NOW)).toBe(false);
    expect(showJustBorrowed({ borrowedAt: NOW - 61 * M, dueAt: NOW + 4 * 60 * M, hasBookmark: false }, NOW)).toBe(false);
    expect(showJustBorrowed({ borrowedAt: NOW - 10 * M, dueAt: NOW + 50 * M, hasBookmark: false }, NOW)).toBe(false);
    expect(showJustBorrowed({ dueAt: NOW + 4 * 60 * M, hasBookmark: false }, NOW)).toBe(false);
  });
  it("is left out of the proof copy and the loan's borrow time reaches the room", () => {
    expect(readFileSync("components/ReaderView.tsx", "utf8")).toContain("{!proof && <JustBorrowedLine borrowedAt={data.borrowedAt} dueAt={data.dueAt} hasBookmark={!!data.bookmark} />}");
    const room = readFileSync("lib/readingRoom.ts", "utf8");
    expect(room).toContain("borrowedAt: loan.borrowedAt,");
    expect(room).toContain('select("id, due_at, bookmark_offset, renewals, borrowed_at")');
  });
});
