import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// C194: Borrowing history rows carry the book's own notes count, the way Hours per book does (C186).
describe("Borrowing history notes count (C194)", () => {
  const src = readFileSync("app/ledger/page.tsx", "utf8");
  const history = src.slice(src.indexOf('aria-labelledby="history"'));
  it("each row shows own counts by work (library) or this browser's (preview)", () => {
    expect(history).toContain("notesBy ? <BookNotesCount counts={notesBy[r.workKey] ?? { notes: 0, highlights: 0 }} />");
    expect(history).toContain("<BookNotesCount counts={null} slug={l.slugs[r.workKey]}");
  });
  it("follows the read-for time on the row's stamp line", () => {
    expect(history.indexOf("read for {formatHours(readMs[r.workKey])}")).toBeLessThan(history.indexOf("notesBy[r.workKey]"));
  });
});
