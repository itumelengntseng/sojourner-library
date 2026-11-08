import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { waitingForWords } from "@/lib/waiting";

// C224: one list of everything still waiting for Itu's own words.
const xs = (...flags: boolean[]) => flags.map((isPlaceholder) => ({ isPlaceholder }));
const none = { works: xs(false), kits: xs(false), people: xs(false), places: xs(false), events: xs(false), hallsNamed: true };

describe("What still waits for your words (C224)", () => {
  it("lists each kind with a count and where it's done", () => {
    const r = waitingForWords({ works: xs(true, true, false), kits: xs(true), people: xs(true, false), places: xs(false, true), events: xs(true, true), hallsNamed: false });
    expect(r.allDone).toBe(false);
    expect(r.rows.map((x) => [x.text, x.href])).toEqual([
      ["2 of 3 works on the shelves", "#shelves"],
      ["1 of 1 pitch kit", "/pitch-room"],
      ["1 of 2 people on the family wall", "/writers-room/atlas?only=1#lineage-doc"],
      ["1 of 2 places and 2 of 2 events on the timeline", "/writers-room/atlas?only=1#timeline-doc"],
      ["the halls' names", "#halls"],
    ]);
  });
  it("leaves out what's done, and says when everything is", () => {
    expect(waitingForWords({ ...none, events: xs(true) }).rows.map((x) => x.text)).toEqual(["1 of 1 event on the timeline"]);
    expect(waitingForWords(none)).toEqual({ rows: [], allDone: true });
  });
  it("the room shows the panel under the glance from the copies in use", () => {
    const page = readFileSync("app/writers-room/page.tsx", "utf8");
    expect(page).toContain("waitingForWords({");
    expect(page).toContain("Everything is in your own words.");
    expect(page).toContain('aria-labelledby="waiting"');
  });
});

describe("waiting works are named with their own replace links (C227)", () => {
  const w = (slug: string, isPlaceholder = true) => ({ slug, title: slug.replace(/-/g, " "), isPlaceholder });
  const base = { kits: [], people: [], places: [], events: [], hallsNamed: true };
  it("one to three works each get a replace link", () => {
    const row = waitingForWords({ ...base, works: [w("a-b"), w("c", false), w("d")] }).rows[0];
    expect(row.links).toEqual([{ label: "a b", href: "/writers-room?replace=a-b#import" }, { label: "d", href: "/writers-room?replace=d#import" }]);
  });
  it("four or more, or a work without a title, keep the single shelf-list link", () => {
    expect(waitingForWords({ ...base, works: ["a", "b", "c", "d"].map((s) => w(s)) }).rows[0].links).toBeUndefined();
    expect(waitingForWords({ ...base, works: [{ isPlaceholder: true }] }).rows[0].links).toBeUndefined();
  });
  it("the room renders the links", () => {
    expect(readFileSync("app/writers-room/page.tsx", "utf8")).toContain("{r.links.map((l, i) =>");
  });
});
