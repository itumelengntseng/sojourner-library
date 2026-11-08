import { describe, expect, it, vi } from "vitest";
import { atlasFlags, waitingForWords, waitingReadme } from "@/lib/waiting";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/writersRoom", () => ({ ownerClient: async () => ({ supabase: null, reason: "preview" }) }));

// C229: the backup's README says what is still placeholder — the same counts as the Writer's Room panel.
describe("backup README: still waiting for your words (C229)", () => {
  it("lists the panel's rows as plain text, or says nothing is left", () => {
    const w = waitingForWords({ works: [{ isPlaceholder: true }], kits: [], people: [], places: [], events: [], hallsNamed: true });
    expect(waitingReadme(w)).toEqual(["Still waiting for your words (placeholder text, not yet replaced):", "  - 1 of 1 work on the shelves"]);
    expect(waitingReadme({ rows: [], allDone: true })).toEqual(["Still waiting for your words: nothing — everything is in your own words."]);
  });
  it("reads flags from a stored document as saved (missing flag = placeholder; malformed = empty)", () => {
    expect(atlasFlags({ people: [{ isPlaceholder: false }, {}, null] }, "people")).toEqual([{ isPlaceholder: false }, { isPlaceholder: true }, { isPlaceholder: true }]);
    expect(atlasFlags({ people: "nope" }, "people")).toEqual([]);
    expect(atlasFlags(null, "events")).toEqual([]);
  });
  it("the preview backup's README carries the section", async () => {
    const { backupEntries } = await import("@/lib/backupServer");
    const entries = await backupEntries({ supabase: null, reason: "preview" } as never, new Date("2026-11-08T10:00:00Z"));
    const readme = String(entries!.find((e) => e.name === "README.txt")!.data);
    expect(readme).toContain("Still waiting for your words (placeholder text, not yet replaced):");
    expect(readme).toContain("  - 3 of 3 works on the shelves");
    expect(readme).toContain("  - 3 of 3 pitch kits");
    expect(readme).toMatch(/ {2}- \d+ of \d+ people on the family wall/);
    expect(readme).toContain("  - the halls' names");
    expect(readme).toContain("All works by Itumeleng Ntseng.");
  });
});
