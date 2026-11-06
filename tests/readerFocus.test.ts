import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FOCUS_RING, THEME_BACKGROUND, THEME_CLASSES } from "@/lib/reader";

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

describe("reading room focus (C30)", () => {
  it("the focus ring stands out (≥ 3:1) on every page colour", () => {
    for (const t of ["dark", "sepia", "light"] as const) expect(contrast(FOCUS_RING[t], THEME_BACKGROUND[t])).toBeGreaterThanOrEqual(3);
  });
  it("the backgrounds match the theme classes", () => {
    expect(THEME_CLASSES.sepia).toContain(THEME_BACKGROUND.sepia);
    expect(THEME_CLASSES.light).toContain(THEME_BACKGROUND.light);
    expect(readFileSync("app/globals.css", "utf8")).toContain("--color-ink: " + THEME_BACKGROUND.dark);
  });
  it("has a skip link straight to the chapter text", () => {
    const src = readFileSync("components/ReaderView.tsx", "utf8");
    expect(src).toContain('href="#chapter-text"');
    expect(src).toContain('id="chapter-text"');
    expect(src).toContain("data-ring");
  });
});
