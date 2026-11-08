import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// C240: Hours per book marks placeholder books, as the notes export does (C236).
describe("Hours per book placeholder mark (C240)", () => {
  it("the ledger loads which books are still placeholders (preview and library)", () => {
    const s = readFileSync("lib/ledgerStore.ts", "utf8");
    expect(s).toContain("placeholders: getWorks().filter((w) => w.isPlaceholder).map((w) => w.slug)");
    expect(s).toContain('supabase.from("works").select("id, slug, title, is_placeholder")');
    expect(s).toContain("placeholders: (works ?? []).filter((w) => w.is_placeholder !== false).map((w) => w.id as string)");
  });
  it("each such row says '· placeholder' after its title", () => {
    expect(readFileSync("app/ledger/page.tsx", "utf8")).toContain("{l.placeholders?.includes(h.workKey) && <span className=\"font-sans text-xs text-sandstone\" data-placeholder-mark> · placeholder</span>}");
  });
});
