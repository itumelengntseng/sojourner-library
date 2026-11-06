import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TIMELINE } from "@/content/timeline";
import { getWorks } from "@/lib/catalogue";
import {
  dateLabel, eventsBetween, MAP, parseDate, project, sortEvents, timelineForWorks, validateTimeline, yearSpan,
  type TimelineEvent,
} from "@/lib/timeline";
import { HarlemMap } from "@/components/HarlemMap";

const ev = (id: string, date: string, extra: Partial<TimelineEvent> = {}): TimelineEvent =>
  ({ id, title: id, isPlaceholder: true, date, appearsIn: [], ...extra });

describe("the timeline file", () => {
  it("is valid and wholly placeholder until the author supplies it", () => {
    expect(validateTimeline(TIMELINE, getWorks().map((w) => w.slug))).toEqual([]);
    expect(TIMELINE.places.every((p) => p.isPlaceholder)).toBe(true);
    expect(TIMELINE.events.every((e) => e.isPlaceholder && /^Placeholder /.test(e.title))).toBe(true);
  });
});

describe("dates", () => {
  it("reads years, months and days, and labels them", () => {
    expect(parseDate("1924")).toMatchObject({ year: 1924, label: "1924" });
    expect(parseDate("1924-03")?.label).toBe("March 1924");
    expect(parseDate("1924-03-15")?.label).toBe("15 March 1924");
    for (const bad of ["24", "1924-13", "1924-03-32", "March 1924", ""]) expect(parseDate(bad)).toBeNull();
    expect(dateLabel(ev("x", "1920", { approximate: true }))).toBe("c. 1920");
  });
  it("sorts by date, year-only before months in the same year", () => {
    expect(sortEvents([ev("c", "1924-05"), ev("a", "1924"), ev("b", "1923-12-31")]).map((e) => e.id)).toEqual(["b", "a", "c"]);
  });
  it("filters by year range and finds the span", () => {
    const es = [ev("a", "1900"), ev("b", "1915-06"), ev("c", "1930")];
    expect(eventsBetween(es, 1910, 1930).map((e) => e.id)).toEqual(["b", "c"]);
    expect(yearSpan(es)).toEqual([1900, 1930]);
    expect(yearSpan([])).toBeNull();
  });
});

describe("validation", () => {
  it("explains mistakes in plain words", () => {
    const errs = validateTimeline({
      isPlaceholder: true,
      places: [
        { id: "p", name: "P", isPlaceholder: true, street: 99, avenue: "fifth" },
        { id: "q", name: "Q", isPlaceholder: true, street: 120 },
        { id: "r", name: "R", isPlaceholder: true },
        { id: "p", name: "P2", isPlaceholder: true, elsewhere: "Free State" },
      ],
      events: [ev("e", "spring 1924", { placeId: "nowhere", appearsIn: ["ghost"] }), ev("e", "1924")],
    }, ["real"]).join("\n");
    expect(errs).toMatch(/off the Harlem map/);
    expect(errs).toMatch(/both a street and an avenue/);
    expect(errs).toMatch(/spot on the map or an "elsewhere"/);
    expect(errs).toMatch(/Place "p" appears twice/);
    expect(errs).toMatch(/can't read: "spring 1924"/);
    expect(errs).toMatch(/"nowhere", which isn't a listed place/);
    expect(errs).toMatch(/"ghost", which isn't in the catalogue/);
    expect(errs).toMatch(/Event "e" appears twice/);
  });
});

describe("the map", () => {
  it("puts north at the top and the east side on the right", () => {
    const south = project(110, "fifth");
    const north = project(155, "fifth");
    expect(north.y).toBeLessThan(south.y);
    expect(project(125, "first").x).toBeGreaterThan(project(125, "morningside").x);
    expect(project(110, "morningside")).toEqual({ x: MAP.pad, y: MAP.height - MAP.pad });
  });
  it("follows the canon switch: events from out-of-view works drop away", () => {
    const t = timelineForWorks(TIMELINE, new Set(["placeholder-work-one", "placeholder-work-two"]));
    expect(t.events.some((e) => e.appearsIn.includes("placeholder-work-three"))).toBe(false);
    expect(t.places).toHaveLength(TIMELINE.places.length);
  });
  it("renders the plan, the year sliders and the event list", () => {
    const html = renderToStaticMarkup(<HarlemMap timeline={TIMELINE} works={{}} />);
    expect(html).toContain("Street plan of Harlem");
    expect(html).toContain("125th");
    expect(html).toContain('type="range"');
    expect(html).toContain("Placeholder Event 3");
    expect(html).toContain("c. 1900");
  });
});
