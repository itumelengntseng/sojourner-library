import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { linkTimeLeft } from "@/lib/pitch";

describe("pitch share link — time left (C123)", () => {
  const now = Date.parse("2026-11-07T10:00:00Z"); // 12:00 SAST, Sat 7 Nov
  it("says the date and the SA days left", () => {
    expect(linkTimeLeft("2026-11-21T10:00:00Z", now)).toBe("open until 21 Nov · 14 days left");
    expect(linkTimeLeft("2026-11-08T08:00:00Z", now)).toBe("open until 8 Nov · 1 day left");
  });
  it("counts by the SA calendar, not UTC", () => {
    // 23:30 UTC on the 7th is 01:30 SAST on the 8th — tomorrow, not today.
    expect(linkTimeLeft("2026-11-07T23:30:00Z", now)).toBe("open until 8 Nov · 1 day left");
    // 21:30 UTC on the 7th is 23:30 SAST on the 7th — the final day.
    expect(linkTimeLeft("2026-11-07T21:30:00Z", now)).toBe("open until 7 Nov · last day");
  });
  it("says 'last day' on its final day and nothing once it has run out", () => {
    expect(linkTimeLeft("2026-11-07T15:00:00Z", now)).toBe("open until 7 Nov · last day");
    expect(linkTimeLeft("2026-11-07T09:59:00Z", now)).toBeNull();
    expect(linkTimeLeft("not a date", now)).toBeNull();
  });
  it("is what the Pitch Room shows on each open link", () => {
    const src = readFileSync("app/pitch-room/page.tsx", "utf8");
    expect(src).toMatch(/linkTimeLeft\(l\.expiresAt, now\)/);
    expect(src).not.toMatch(/toLocaleDateString\("en-ZA", \{ timeZone/);
  });
});

describe("pitch share link — Last day mark (C125)", () => {
  const now = Date.parse("2026-11-07T10:00:00Z");
  it("names the closing time on the final day only", async () => {
    const { lastDayLabel } = await import("@/lib/pitch");
    expect(lastDayLabel("2026-11-07T16:30:00Z", now)).toBe("Last day: closes 18:30");
    expect(lastDayLabel("2026-11-08T08:00:00Z", now)).toBeNull();
    expect(lastDayLabel("2026-11-07T09:00:00Z", now)).toBeNull();
  });
  it("the Pitch Room marks open links on their last day, spoken with the time", () => {
    const src = readFileSync("app/pitch-room/page.tsx", "utf8");
    expect(src).toMatch(/!l\.revoked && lastDayLabel\(l\.expiresAt, now\)/);
    expect(src).toMatch(/border-ember[^"]*text-ember">\s*Last day<span className="sr-only">/);
  });
});

describe("pitch share links — open first (C130)", () => {
  const now = Date.parse("2026-11-07T10:00:00Z");
  const l = (id: string, expiresAt: string, revoked = false) => ({ id, expiresAt, revoked });
  it("lists open links soonest-closing first, then closed and expired ones in their given order", async () => {
    const { orderLinks } = await import("@/lib/pitch");
    const r = orderLinks([l("expired", "2026-11-01T00:00:00Z"), l("late", "2026-11-30T00:00:00Z"), l("closed", "2026-11-20T00:00:00Z", true), l("soon", "2026-11-09T00:00:00Z")], now);
    expect(r.links.map((x) => x.id)).toEqual(["soon", "late", "expired", "closed"]);
    expect(r.open).toBe(2);
    expect(orderLinks([l("closed", "2026-11-20T00:00:00Z", true)], now).open).toBe(0);
  });
  it("the Pitch Room says how many are open before the list", () => {
    const src = readFileSync("app/pitch-room/page.tsx", "utf8");
    expect(src).toMatch(/orderLinks\(links\.filter\(\(l\) => l\.slug === k\.slug\), now\)/);
    expect(src).toContain('{openLinks === 0 ? "No link open" : `${openLinks} open`} · {mine.length} shared in all');
  });
});
