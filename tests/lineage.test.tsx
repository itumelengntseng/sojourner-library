import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LINEAGE } from "@/content/lineage";
import { getWorks } from "@/lib/catalogue";
import { connection, describeConnection, generations, peopleInWork, relativesOf, validateLineage, type Person } from "@/lib/lineage";
import { LineageWall } from "@/components/LineageWall";

const p = (id: string, parents: string[] = [], partners: string[] = [], appearsIn: string[] = []): Person =>
  ({ id, name: id.toUpperCase(), isPlaceholder: true, parents, partners, appearsIn });

const fam = [p("a", [], ["b"]), p("b"), p("c"), p("d", ["a", "b"], ["e"]), p("e", ["c"]), p("f", ["a", "b"]), p("g", ["d", "e"]), p("lone")];

describe("the lineage file", () => {
  it("is valid and wholly placeholder until the author supplies it", () => {
    expect(validateLineage(LINEAGE, getWorks().map((w) => w.slug))).toEqual([]);
    expect(LINEAGE.isPlaceholder).toBe(true);
    expect(LINEAGE.people.every((x) => x.isPlaceholder && /^Placeholder /.test(x.name))).toBe(true);
  });
});

describe("validation", () => {
  it("catches unknown relatives, duplicates, bad ids, self-reference and too many parents", () => {
    const errs = validateLineage({ title: "", isPlaceholder: true, people: [
      p("x", ["nobody"]), p("x"), p("Bad Id"), p("s", ["s"]), p("m", ["x", "s", "Bad Id"]),
    ] });
    expect(errs.join("\n")).toMatch(/"nobody", who isn't/);
    expect(errs.join("\n")).toMatch(/"x" appears twice/);
    expect(errs.join("\n")).toMatch(/not a valid id/);
    expect(errs.join("\n")).toMatch(/own relative/);
    expect(errs.join("\n")).toMatch(/more than two parents/);
  });
  it("catches ancestry loops and unknown works", () => {
    expect(validateLineage({ title: "", isPlaceholder: true, people: [p("a", ["b"]), p("b", ["a"])] })).toEqual(["Someone is listed as their own ancestor."]);
    expect(validateLineage({ title: "", isPlaceholder: true, people: [p("a", [], [], ["ghost"])] }, ["real"])[0]).toMatch(/"ghost"/);
  });
});

describe("the wall", () => {
  it("lays people out by generation, partners side by side", () => {
    const rows = generations(fam).map((r) => r.map((x) => x.id).sort());
    expect(rows).toEqual([["a", "b", "c", "lone"], ["d", "e", "f"], ["g"]]);
  });
  it("finds relatives in both directions", () => {
    const r = relativesOf(fam, "d");
    expect(r.parents.map((x) => x.id)).toEqual(["a", "b"]);
    expect(r.partners.map((x) => x.id)).toEqual(["e"]);
    expect(r.siblings.map((x) => x.id)).toEqual(["f"]);
    expect(r.children.map((x) => x.id)).toEqual(["g"]);
    expect(relativesOf(fam, "b").partners.map((x) => x.id)).toEqual(["a"]);
  });
  it("traces the shortest tie between two people", () => {
    const path = connection(fam, "f", "c")!;
    expect(path.map((s) => s.relation)).toEqual(["child of", "parent of", "partner of", "child of"]);
    expect(describeConnection(fam, connection(fam, "g", "e")!)).toBe("G is child of E.");
    expect(connection(fam, "a", "lone")).toBeNull();
    expect(connection(fam, "a", "a")).toEqual([]);
  });
  it("lists who appears in a work", () => {
    expect(peopleInWork(LINEAGE.people, "placeholder-work-three").map((x) => x.id)).toEqual(["placeholder-child-b"]);
  });
  it("renders plaques with placeholder marks and links to works", () => {
    const html = renderToStaticMarkup(<LineageWall people={LINEAGE.people} works={{ "placeholder-work-one": "Placeholder Work One" }} />);
    expect(html).toContain("Generation 3");
    expect(html).toContain("Placeholder Elder A");
    expect(html).toContain('href="/works/placeholder-work-one"');
    expect(html).toContain("How are they connected?");
  });
});

describe("C58 find a person", async () => {
  const { findPeople } = await import("@/lib/lineage");
  const p = (id: string, name: string) => ({ id, name, isPlaceholder: true, parents: [], partners: [], appearsIn: [] });
  const people = [p("a", "Placeholder Élder Mosa"), p("b", "Placeholder Child Two"), p("c", "Placeholder Child One")];
  it("matches every word of the name, ignoring case and accents", () => {
    expect([...findPeople(people, "elder")]).toEqual(["a"]);
    expect([...findPeople(people, "CHILD one")]).toEqual(["c"]);
    expect(findPeople(people, "child").size).toBe(2);
    expect(findPeople(people, "nobody").size).toBe(0);
    expect([...findPeople(people, "mo")]).toEqual(["a"]); // word starts…
    expect(findPeople(people, "osa").size).toBe(0);       // …not the middle of a word
  });
  it("an empty query matches everyone", () => {
    expect(findPeople(people, "  ").size).toBe(3);
  });
});
