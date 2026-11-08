import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importedMessage } from "@/lib/manuscript";

// C216: after an import the Writer's Room names the work, says where it stands, and offers the proof copy.
describe("import status (C216)", () => {
  it("names the work, its size and where it stands", () => {
    expect(importedMessage("Placeholder Work Four", 2, 12345, "draft", "owner")).toBe('Saved "Placeholder Work Four" — 2 chapters, 12 345 words · Draft · Only me.');
    expect(importedMessage("Placeholder Work Four", 1, 40, "canon", "members")).toBe('Saved "Placeholder Work Four" — 1 chapter, 40 words · Canon · shared with card holders.');
    expect(importedMessage("X", 1, 1, "nonsense", "owner")).toContain("· Draft · Only me.");
  });
  it("the action reads the work's sharing after saving and links its proof copy; the status shows the link", () => {
    const action = readFileSync("app/writers-room/actions.ts", "utf8");
    expect(action).toContain('supabase.from("works").select("visibility").eq("slug", slug).maybeSingle()');
    expect(action).toContain('link: { href: `/works/${slug}/proof`, label: "Open the proof copy" }');
    expect(readFileSync("components/WritersRoomForms.tsx", "utf8")).toContain("{s.ok && s.link && <p className=\"mt-1\"><a href={s.link.href}");
  });
});
