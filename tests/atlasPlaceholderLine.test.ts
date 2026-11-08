import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkAtlas, placeholderLine, toAtlasText } from "@/lib/atlas";
import { LINEAGE } from "@/content/lineage";
import { TIMELINE } from "@/content/timeline";

// C222: the family wall & timeline editor says how much is still placeholder, in the copy being edited.
const p = (isPlaceholder: boolean) => ({ isPlaceholder });

describe("atlas placeholder line (C222)", () => {
  it("counts people", () => {
    expect(placeholderLine({ people: [p(true), p(true), p(false)] })).toBe("2 of 3 people are still placeholders — tick “Real” on each one in your own words.");
    expect(placeholderLine({ people: [p(true)] })).toBe("1 of 1 person is still a placeholder — tick “Real” on each one in your own words.");
    expect(placeholderLine({ people: [p(false), p(false)] })).toBe("Every person is in your own words.");
    expect(placeholderLine({ people: [] })).toBe("Nothing here yet.");
  });
  it("counts places and events together", () => {
    expect(placeholderLine({ places: [p(false), p(true)], events: [p(true), p(true)] })).toBe("1 of 2 places and 2 of 2 events are still placeholders — tick “Real” on each one in your own words.");
    expect(placeholderLine({ places: [p(false)], events: [p(false)] })).toBe("Every place and event is in your own words.");
    expect(placeholderLine({ places: [], events: [p(true)] })).toBe("1 of 1 event is still a placeholder — tick “Real” on each one in your own words.");
  });
  it("the shipped files are all placeholders (nothing invented)", () => {
    const l = checkAtlas("lineage", toAtlasText(LINEAGE), ["placeholder-work-one", "placeholder-work-two", "placeholder-work-three"]);
    const t = checkAtlas("timeline", toAtlasText(TIMELINE), ["placeholder-work-one", "placeholder-work-two", "placeholder-work-three"]);
    expect(l.ok && placeholderLine(l.value)).toMatch(/^(\d+) of \1 people are still placeholders/);
    expect(t.ok && placeholderLine(t.value)).toMatch(/^(\d+) of \1 places and (\d+) of \2 events are still placeholders/);
  });
  it("the editor shows it live once the copy checks out", () => {
    expect(readFileSync("components/AtlasEditor.tsx", "utf8")).toContain("{check.ok && <p className=\"font-sans text-xs text-sandstone\" data-placeholder-line>{placeholderLine(check.value)}</p>}");
  });
});
