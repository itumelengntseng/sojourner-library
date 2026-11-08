import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importPlan, OWN_WORDS_LINE, parseManuscript, planSummary, type ShelvedWork } from "@/lib/manuscript";

// C221: re-importing over a work still marked Placeholder says Save makes it the author's own words.
const md = parseManuscript("## Chapter one\n\nMy own text.\n");
const shelved = (placeholder?: boolean, setAside = false): ShelvedWork => ({ title: "W", setAside, chapters: [{ position: 1, title: "Chapter one", words: 3, archived: false }], ...(placeholder === undefined ? {} : { placeholder }) });

describe("import preview: placeholder becomes own words (C221)", () => {
  it("says so only when the shelved work is still a placeholder", () => {
    expect(OWN_WORDS_LINE).toBe("Saving marks it as your own words — it stops being a placeholder.");
    expect(planSummary(importPlan(md, shelved(true)))).toBe(`Updates the work already on the shelves: 1 unchanged. ${OWN_WORDS_LINE}`);
    expect(planSummary(importPlan(md, shelved(false)))).not.toContain(OWN_WORDS_LINE);
    expect(planSummary(importPlan(md, shelved()))).not.toContain(OWN_WORDS_LINE);
    expect(planSummary(importPlan(md, undefined))).not.toContain(OWN_WORDS_LINE);
  });
  it("follows the set-aside note when both apply", () => {
    expect(planSummary(importPlan(md, shelved(true, true)))).toMatch(/until you restore it\. Saving marks it as your own words/);
  });
  it("matches what the database does, and both shelves carry the flag", () => {
    expect(readFileSync("supabase/migrations/0006_writers_room.sql", "utf8")).toContain("is_placeholder = false");
    const room = readFileSync("lib/writersRoom.ts", "utf8");
    expect(room).toContain("placeholder: !!w.is_placeholder");
    expect(room).toContain("setAside: false, placeholder: true");
    expect(room).toContain('select("id, slug, title, archived_at, is_placeholder")');
  });
});
