import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// C225: a placeholder kit's status on its Pitch Room card links to its editor (spoken with the work's title).
describe("Pitch Room placeholder status link (C225)", () => {
  it("links the placeholder status to the kit's editor", () => {
    const page = readFileSync("app/pitch-room/page.tsx", "utf8");
    expect(page).toContain("? <Link href={`/pitch-room/${k.slug}/edit`}");
    expect(page).toContain("Placeholder — awaiting the author&apos;s words<span className=\"sr-only\">: edit the kit for {p.work.title}</span></Link>");
    expect(page).toContain('"Ready to send"');
  });
});
