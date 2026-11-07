import { describe, expect, it } from "vitest";
import { getWorks, HALLS, type Work } from "@/lib/catalogue";
import { NO_BLURB } from "@/lib/catalogueRows";
import { chapterHits, cleanQuery, fold, resultLine, searchShelves } from "@/lib/shelfSearch";

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

describe("C51 search matches chapter titles (titles only)", () => {
  const ch = (titles: string[]) => titles.map((title, i) => ({ position: i + 1, title, body: "Placeholder body mentioning lighthouse." }));
  const shelf = [
    w({ slug: "x", title: "Placeholder Lamp Book", chapters: ch(["Placeholder Courtyard Gate", "Placeholder Night Market"]) }),
    w({ slug: "y", title: "Placeholder Stone Book", chapters: ch(["Placeholder Threshold"]) }),
  ];
  it("finds a work by a chapter title, and says which chapter", () => {
    expect(searchShelves(shelf, halls, "night market").map((x) => x.slug)).toEqual(["x"]);
    expect(chapterHits(shelf[0], halls, "night market")).toEqual([{ position: 2, title: "Placeholder Night Market" }]);
  });
  it("never searches chapter text", () => {
    expect(searchShelves(shelf, halls, "lighthouse")).toEqual([]);
  });
  it("words can be split between the work and a chapter title; only the chapter-word is shown as a hit", () => {
    expect(searchShelves(shelf, halls, "lamp courtyard").map((x) => x.slug)).toEqual(["x"]);
    expect(chapterHits(shelf[0], halls, "lamp courtyard").map((c) => c.position)).toEqual([1]);
  });
  it("no chapter hits when the work matched on its own details", () => {
    expect(chapterHits(shelf[0], halls, "placeholder")).toEqual([]);
    expect(chapterHits(shelf[1], halls, "stone")).toEqual([]);
  });
  it("at most three hits per work", () => {
    const many = w({ slug: "z", title: "Placeholder Z", chapters: ch(["Yard one", "Yard two", "Yard three", "Yard four"]) });
    expect(chapterHits(many, halls, "yard")).toHaveLength(3);
  });
});
