import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { keeperLine, waitingForWords } from "@/lib/waiting";

// C232: the Keeper's one line on the front hall — what still waits for his words.
const xs = (...f: boolean[]) => f.map((isPlaceholder) => ({ isPlaceholder }));

describe("Keeper's line on the front hall (C232)", () => {
  it("lists the short forms, or nothing when all is done", () => {
    expect(keeperLine(waitingForWords({ works: xs(true, true, true), kits: xs(true, true, true), people: xs(true, true), places: xs(true), events: xs(true, true), hallsNamed: false })))
      .toBe("Still waiting for your words: 3 works, 3 pitch kits, 2 people, 1 place, 2 events and the hall names.");
    expect(keeperLine(waitingForWords({ works: xs(true), kits: [], people: [], places: [], events: [], hallsNamed: true }))).toBe("Still waiting for your words: 1 work.");
    expect(keeperLine(waitingForWords({ works: xs(false), kits: xs(false), people: [], places: [], events: [], hallsNamed: true }))).toBeNull();
  });
  it("only the Keeper gets it (owner, or preview where the Writer's Room is open)", () => {
    const store = readFileSync("lib/waitingStore.ts", "utf8");
    expect(store).toContain('if (reason !== "preview" && !supabase) return null;');
    expect(store).toContain('import "server-only";');
    const page = readFileSync("app/page.tsx", "utf8");
    expect(page).toContain("const keeper = waiting ? keeperLine(waiting) : null;");
    expect(page).toContain('href="/writers-room#waiting"');
  });
});
