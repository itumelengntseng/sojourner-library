import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PitchSheet } from "@/components/PitchSheet";
import { PrintSheetButton } from "@/components/PrintSheetButton";
import { getPitch } from "@/content/pitches";

const work = { title: "Placeholder Work One", author: "Itumeleng Ntseng", words: 14256, readingTime: "1 h 2 min" };
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const printCss = css.slice(css.indexOf("@media print"));

describe("print-friendly pitch sheet", () => {
  it("marks the sheet for print and keeps authorship and the placeholder notice on paper", () => {
    const html = renderToStaticMarkup(<PitchSheet kit={getPitch("placeholder-work-one")!} work={work} />);
    expect(html).toMatch(/class="pitch-sheet /);
    expect(html).toContain("by Itumeleng Ntseng");
    expect(html).toContain("© Itumeleng Ntseng");
    expect(html).toContain("Placeholder pitch");
    expect(html).not.toContain("no-print"); // nothing on the sheet itself is hidden from paper
    expect(html).toContain('class="sheet-keep"');
  });
  it("hides the print button itself on paper", () => {
    const html = renderToStaticMarkup(<PrintSheetButton />);
    expect(html).toContain("no-print");
    expect(html).toMatch(/Print or save as PDF/);
  });
  it("prints on white paper with no nav, no shadow and sensible breaks", () => {
    expect(css).toMatch(/@page\s*\{[^}]*size:\s*A4/);
    expect(printCss).toMatch(/\.no-print\s*\{\s*display:\s*none !important/);
    expect(printCss).toMatch(/background:\s*#fff !important/);
    expect(printCss).toMatch(/box-shadow:\s*none !important/);
    expect(printCss).toMatch(/break-after:\s*avoid/);
    expect(printCss).toMatch(/break-inside:\s*avoid/);
  });
  it("keeps the site nav and footer off the printed page", () => {
    expect(readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8")).toMatch(/<footer className="no-print/);
    for (const f of ["../app/pitch-room/[slug]/page.tsx", "../app/p/[token]/page.tsx"]) {
      const src = readFileSync(new URL(f, import.meta.url), "utf8");
      expect(src).toContain("PrintSheetButton");
      expect(src).toContain("sheet-page");
    }
    expect(readFileSync(new URL("../app/pitch-room/[slug]/page.tsx", import.meta.url), "utf8")).toMatch(/<nav className="no-print/);
  });
});
