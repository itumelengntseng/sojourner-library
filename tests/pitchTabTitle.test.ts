import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pitchTabTitle } from "@/lib/pitch";

// C238: the pitch sheet's tab title says "(placeholder)" while the kit is still one.
describe("pitch tab title (C238)", () => {
  it("adds (placeholder) only for a placeholder kit", () => {
    expect(pitchTabTitle("A private pitch", true)).toBe("A private pitch (placeholder)");
    expect(pitchTabTitle("A private pitch", false)).toBe("A private pitch");
  });
  it("the share page opens the link once per request (title and page share it), so a visit counts once", () => {
    const share = readFileSync("app/p/[token]/page.tsx", "utf8");
    expect(share).toContain("const openOnce = cache((token: string) => openSharedPitch(token));");
    expect(share.match(/openSharedPitch\(/g)?.length).toBe(1);
    expect(share.match(/await openOnce\(/g)?.length).toBe(2);
    expect(share).toContain('robots: { index: false, follow: false }, referrer: "no-referrer"');
  });
  it("the Keeper's sheet names the work and says (placeholder) too", () => {
    const sheet = readFileSync("app/pitch-room/[slug]/page.tsx", "utf8");
    expect(sheet).toContain("pitchTabTitle(p ? `Pitch sheet: ${p.work.title}` : \"Pitch sheet\", !!p?.kit.isPlaceholder)");
    expect(sheet.match(/await pitchOnce\(/g)?.length).toBe(2);
  });
});
