import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importedMessage } from "@/lib/manuscript";

// C230: the import status says when the save replaced a work still marked Placeholder.
describe("import status after replacing a placeholder (C230)", () => {
  it("adds 'no longer a placeholder' only when it was one", () => {
    expect(importedMessage("Placeholder Work One", 2, 1200, "draft", "owner", true)).toBe('Saved "Placeholder Work One" — 2 chapters, 1 200 words · Draft · Only me · no longer a placeholder.');
    expect(importedMessage("New", 1, 10, "canon", "members", false)).toBe('Saved "New" — 1 chapter, 10 words · Canon · shared with card holders.');
    expect(importedMessage("New", 1, 10, "canon", "members")).not.toContain("placeholder");
  });
  it("the action reads the mark before saving", () => {
    const a = readFileSync("app/writers-room/actions.ts", "utf8");
    const read = a.indexOf('select("is_placeholder").eq("slug", slug).maybeSingle()');
    expect(read).toBeGreaterThan(0);
    expect(read).toBeLessThan(a.indexOf('supabase.rpc("import_manuscript"'));
    expect(a).toContain("importedMessage(title, parsed.chapters.length, parsed.words, canon, visibility, replacedPlaceholder)");
  });
});
