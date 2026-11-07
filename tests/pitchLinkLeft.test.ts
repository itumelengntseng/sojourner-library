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
