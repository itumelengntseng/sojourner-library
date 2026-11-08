import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pickerList } from "@/lib/atlas";

// C226: "Placeholders only" on the family wall / timeline pickers.
const items = [{ id: "a", isPlaceholder: true }, { id: "b", isPlaceholder: false }, { id: "c", isPlaceholder: true }];

describe("Placeholders only (C226)", () => {
  it("off → everything in order; on → placeholders plus the one open", () => {
    expect(pickerList(items, "b", false).map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(pickerList(items, null, true).map((x) => x.id)).toEqual(["a", "c"]);
    expect(pickerList(items, "b", true).map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(pickerList(items.map((x) => ({ ...x, isPlaceholder: false })), null, true)).toEqual([]);
  });
  it("people, events and places pickers all use it", () => {
    const f = readFileSync("components/AtlasForms.tsx", "utf8");
    expect(f).toContain("pickerList(value.people, sel, only)");
    expect(f).toContain("pickerList(value.events, sel, only)");
    expect(f).toContain("pickerList(value.places, selPlace, only)");
    expect(f.match(/<PlaceholdersOnly /g)?.length).toBe(3);
  });
});
