import { describe, expect, it } from "vitest";
import { getWorks, HALLS, type Work } from "@/lib/catalogue";
import { NO_BLURB } from "@/lib/catalogueRows";
import { cleanQuery, fold, resultLine, searchShelves } from "@/lib/shelfSearch";

const base = getWorks()[0];
const w = (over: Partial<Work>): Work => ({ ...base, ...over });
const halls = [...HALLS, { id: "far-hall", name: "The Courtyard Hall", note: "" }];
const works = [
  w({ slug: "a", title: "Placeholder Lamp Book", series: "Placeholder Series One", hall: "main", blurb: "A placeholder description written by the author about a séance." }),
  w({ slug: "b", title: "Placeholder Stone Book", series: null, hall: "far-hall", blurb: NO_BLURB }),
  w({ slug: "c", title: "Placeholder Timber Book", series: null, hall: "main", blurb: "Placeholder description. The real description will come from the author." }),
];
const slugs = (q: string) => searchShelves(works, halls, q).map((x) => x.slug);

describe("search the shelves", () => {
  it("returns every work for an empty query", () => {
    expect(slugs("")).toEqual(["a", "b", "c"]);
    expect(slugs("   ")).toEqual(["a", "b", "c"]);
  });
  it("matches title, series, hall name and the author's description", () => {
    expect(slugs("lamp")).toEqual(["a"]);
    expect(slugs("series one")).toEqual(["a"]);
    expect(slugs("courtyard")).toEqual(["b"]);
    expect(slugs("SEANCE")).toEqual(["a"]); // accents and case folded
  });
  it("needs every word to match", () => {
    expect(slugs("stone lamp")).toEqual([]);
    expect(slugs("placeholder book")).toEqual(["a", "b", "c"]);
  });
  it("finds every work by the author's name (authorship always on the work)", () => {
    expect(slugs("ntseng")).toEqual(["a", "b", "c"]);
  });
  it("ignores the library's own stand-in description lines", () => {
    expect(slugs("hasn't written")).toEqual([]);
    expect(slugs("real description")).toEqual([]);
  });
  it("tidies and caps the query", () => {
    expect(cleanQuery(undefined)).toBe("");
    expect(cleanQuery(["  two   words ", "x"])).toBe("two words");
    expect(cleanQuery("x".repeat(200))).toHaveLength(80);
    expect(fold("Hlalele, ‘Morena’!")).toBe("hlalele morena");
  });
  it("says how many works match in plain words", () => {
    expect(resultLine(0, "lamp")).toBe("Nothing on the shelves matches “lamp”.");
    expect(resultLine(1, "lamp")).toBe("1 work matches “lamp”.");
    expect(resultLine(3, "book")).toBe("3 works match “book”.");
  });
});
