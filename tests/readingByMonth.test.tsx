import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReadingByMonth } from "@/components/ReadingByMonth";
import { byMonth } from "@/lib/ledger";

const at = (iso: string) => Date.parse(iso);
const s = (iso: string, mins: number) => ({ endedAt: at(iso), activeMs: mins * 60_000, wordsRead: 0 });
const NOW = at("2026-11-06T10:00:00Z");

describe("reading by month", () => {
  it("lists the last twelve months oldest first, empty months included", () => {
    const rows = byMonth([], NOW);
    expect(rows).toHaveLength(12);
    expect(rows[0].key).toBe("2025-12");
    expect(rows[11].key).toBe("2026-11");
    expect(rows[11].long).toMatch(/November 2026/);
    expect(rows.every((r) => r.activeMs === 0)).toBe(true);
  });
  it("adds each session to its month in South African time", () => {
    const rows = byMonth([s("2026-11-01T08:00:00Z", 30), s("2026-11-03T08:00:00Z", 15), s("2026-10-31T22:30:00Z", 10), s("2026-10-31T21:30:00Z", 5)], NOW);
    const get = (k: string) => rows.find((r) => r.key === k)!.activeMs / 60_000;
    expect(get("2026-11")).toBe(55); // 22:30 UTC on 31 Oct is 00:30 on 1 Nov in SA
    expect(get("2026-10")).toBe(5);
  });
  it("leaves out sessions older than the window and handles the year boundary", () => {
    const rows = byMonth([s("2025-11-20T08:00:00Z", 99), s("2025-12-02T08:00:00Z", 7)], NOW);
    expect(rows.reduce((a, r) => a + r.activeMs, 0) / 60_000).toBe(7);
    expect(byMonth([], at("2026-01-10T00:00:00Z"), 3).map((r) => r.key)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
  it("draws a bar per month with a spoken label", () => {
    const html = renderToStaticMarkup(<ReadingByMonth months={byMonth([s("2026-11-01T08:00:00Z", 90), s("2026-09-01T08:00:00Z", 45)], NOW)} />);
    expect(html).toContain("Reading by month");
    expect(html).toContain("November 2026: 1 h 30 min");
    expect(html).toContain("September 2026: 45 min");
    expect(html).toContain("August 2026: no reading");
    expect(html).toContain("height:100%");
    expect(html).toContain("height:50%");
  });
});
