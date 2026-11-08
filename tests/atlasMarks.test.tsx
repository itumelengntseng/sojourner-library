import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LineageWall } from "@/components/LineageWall";
import { HarlemMap } from "@/components/HarlemMap";
import { LINEAGE } from "@/content/lineage";
import { TIMELINE } from "@/content/timeline";

// C231: placeholder people, events and places say so on the reader pages (seen and heard).
const marks = (html: string) => (html.match(/data-placeholder-mark/g) ?? []).length;

describe("placeholder marks on the family wall and timeline (C231)", () => {
  it("the wall marks each placeholder plaque and the open person's card", () => {
    const html = renderToStaticMarkup(<LineageWall people={LINEAGE.people} works={{}} />);
    expect(html).toContain("Placeholder — the author&#x27;s own words will replace it");
    expect((html.match(/>Placeholder</g) ?? []).length).toBeGreaterThanOrEqual(LINEAGE.people.length);
  });
  it("the timeline marks every placeholder event and place", () => {
    const html = renderToStaticMarkup(<HarlemMap timeline={TIMELINE} works={{}} />);
    expect(marks(html)).toBe(TIMELINE.events.length + TIMELINE.places.length);
  });
  it("entries in the author's own words carry no mark", () => {
    const real = { ...TIMELINE, events: TIMELINE.events.map((e) => ({ ...e, isPlaceholder: false })), places: TIMELINE.places.map((p) => ({ ...p, isPlaceholder: false })) };
    expect(marks(renderToStaticMarkup(<HarlemMap timeline={real} works={{}} />))).toBe(0);
    const people = LINEAGE.people.map((p) => ({ ...p, isPlaceholder: false }));
    expect(renderToStaticMarkup(<LineageWall people={people} works={{}} />)).not.toContain("data-placeholder-mark");
  });
});
