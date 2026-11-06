import { beforeAll, describe, expect, it } from "vitest";
import { LINEAGE } from "@/content/lineage";
import { TIMELINE } from "@/content/timeline";
import { getWorks } from "@/lib/catalogue";
import { checkAtlas, storedOr, toAtlasText, ATLAS_MAX_CHARS } from "@/lib/atlas";
import { addUser, asUser, attempt, freshDb, type Db } from "./helpers/db";

const known = getWorks().map((w) => w.slug);

describe("editing the family wall and timeline", () => {
  it("accepts the current files unchanged (round trip)", () => {
    const l = checkAtlas("lineage", toAtlasText(LINEAGE), known);
    expect(l.ok && l.value).toEqual(LINEAGE);
    const t = checkAtlas("timeline", toAtlasText(TIMELINE), known);
    expect(t.ok && t.value).toEqual(TIMELINE);
  });
  it("explains broken JSON in plain words", () => {
    const r = checkAtlas("lineage", '{"people": [', known);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors[0]).toMatch(/isn't valid JSON/);
  });
  it("checks the shape: names, lists, avenues, dates as text", () => {
    const l = checkAtlas("lineage", JSON.stringify({ people: [{ id: "placeholder-x", parents: "nope" }] }));
    expect(!l.ok && l.errors.join(" ")).toMatch(/needs a name, "parents" as a list/);
    const t = checkAtlas("timeline", JSON.stringify({
      places: [{ id: "p", name: "Placeholder P", street: 125, avenue: "broadway" }],
      events: [{ id: "e", title: "Placeholder E", date: 1924 }],
    }));
    expect(!t.ok && t.errors.join(" ")).toMatch(/isn't one of the avenues/);
    expect(!t.ok && t.errors.join(" ")).toMatch(/date in quotes/);
    expect(checkAtlas("timeline", "[]").ok).toBe(false);
  });
  it("runs the file validators too (relations, map bounds, unknown works)", () => {
    const l = checkAtlas("lineage", JSON.stringify({ people: [{ id: "placeholder-a", name: "Placeholder A", parents: ["placeholder-ghost"] }] }), known);
    expect(!l.ok && l.errors.join(" ")).toMatch(/isn't in the lineage/);
    const t = checkAtlas("timeline", JSON.stringify({
      places: [{ id: "p", name: "Placeholder P", street: 200, avenue: "fifth" }],
      events: [{ id: "e", title: "Placeholder E", date: "1924", appearsIn: ["no-such-work"] }],
    }), known);
    expect(!t.ok && t.errors.join(" ")).toMatch(/off the Harlem map/);
    expect(!t.ok && t.errors.join(" ")).toMatch(/isn't in the catalogue/);
  });
  it("entries stay placeholders unless marked otherwise", () => {
    const l = checkAtlas("lineage", JSON.stringify({ people: [{ id: "placeholder-a", name: "Placeholder A" }, { id: "real-b", name: "B", isPlaceholder: false }] }));
    expect(l.ok && l.value.isPlaceholder).toBe(true);
    expect(l.ok && l.value.people.map((p) => p.isPlaceholder)).toEqual([true, false]);
  });
  it("refuses an oversized document", () => {
    expect(checkAtlas("lineage", " ".repeat(ATLAS_MAX_CHARS + 1)).ok).toBe(false);
  });
  it("falls back to the file when nothing (or something unreadable) is stored", () => {
    expect(storedOr("lineage", undefined, LINEAGE)).toEqual({ value: LINEAGE, fromLibrary: false });
    expect(storedOr("lineage", { people: "x" }, LINEAGE).fromLibrary).toBe(false);
    const stored = { title: "The family wall", isPlaceholder: true, people: [] };
    expect(storedOr("lineage", stored, LINEAGE)).toEqual({ value: stored, fromLibrary: true });
  });
});

describe("atlas_documents table", () => {
  const OWNER = "00000000-0000-0000-0000-0000000000a1";
  const GUEST = "00000000-0000-0000-0000-0000000000a2";
  const STRANGER = "00000000-0000-0000-0000-0000000000a3";
  let db: Db;
  const save = `insert into atlas_documents (kind, body) values ($1, $2::jsonb) on conflict (kind) do update set body = excluded.body`;

  beforeAll(async () => {
    db = await freshDb();
    await addUser(db, OWNER, "owner");
    await addUser(db, GUEST, "guest");
    await db.query(`insert into auth.users (id) values ($1)`, [STRANGER]);
  }, 30_000);

  it("the owner saves and updates; card holders read", async () => {
    await asUser(db, OWNER, (tx) => tx.query(save, ["lineage", toAtlasText(LINEAGE)]));
    await asUser(db, OWNER, (tx) => tx.query(save, ["lineage", JSON.stringify({ ...LINEAGE, title: "Placeholder wall" })]));
    const seen = await asUser(db, GUEST, async (tx) => (await tx.query<{ body: { title: string } }>(`select body from atlas_documents where kind = 'lineage'`)).rows);
    expect(seen.map((r) => r.body.title)).toEqual(["Placeholder wall"]);
  });
  it("guests can't write, strangers and anon can't read, nobody deletes", async () => {
    expect(await attempt(db, GUEST, save, ["timeline", "{}"])).toMatch(/row-level security/);
    expect(await asUser(db, STRANGER, async (tx) => (await tx.query(`select * from atlas_documents`)).rows.length)).toBe(0);
    expect(await attempt(db, null, `select * from atlas_documents`)).toMatch(/permission denied/);
    expect(await attempt(db, OWNER, `delete from atlas_documents`)).toMatch(/permission denied/);
  });
  it("only knows the two documents, and only objects", async () => {
    expect(await attempt(db, OWNER, save, ["other", "{}"])).toMatch(/check constraint/);
    expect(await attempt(db, OWNER, save, ["timeline", "[]"])).toMatch(/check constraint/);
  });
});

import { makeId, parseForForm, partnersOf, removeEvent, removePerson, removePlace, renamePerson, renamePlace, setPartners } from "@/lib/atlas";
import { validateLineage } from "@/lib/lineage";
import { validateTimeline } from "@/lib/timeline";

describe("form editor helpers", () => {
  it("makes clean, unique ids", () => {
    expect(makeId("Placeholder Élder", [])).toBe("placeholder-elder");
    expect(makeId("New person", ["new-person", "new-person-2"])).toBe("new-person-3");
    expect(makeId("!!!", [], "person")).toBe("person");
  });
  it("opens half-finished work (shape only, no relation checks)", () => {
    const text = JSON.stringify({ people: [{ id: "placeholder-a", name: "Placeholder A", parents: ["placeholder-ghost"] }] });
    expect(parseForForm("lineage", text)?.people).toHaveLength(1);
    expect(parseForForm("lineage", "{")).toBeNull();
    expect(parseForForm("timeline", toAtlasText(TIMELINE))).toEqual(TIMELINE);
  });
  it("renaming a person updates every reference and stays valid", () => {
    const l = renamePerson(LINEAGE, "placeholder-elder-a", "placeholder-elder-z");
    expect(l.people.some((p) => p.id === "placeholder-elder-a" || p.parents.includes("placeholder-elder-a") || p.partners.includes("placeholder-elder-a"))).toBe(false);
    expect(validateLineage(l, known)).toEqual([]);
  });
  it("removing a person leaves no dangling ties", () => {
    const l = removePerson(LINEAGE, "placeholder-child-a");
    expect(l.people).toHaveLength(LINEAGE.people.length - 1);
    expect(validateLineage(l, known)).toEqual([]);
  });
  it("partners show on both sides and are stored once", () => {
    expect(partnersOf(LINEAGE, "placeholder-elder-b")).toEqual(["placeholder-elder-a"]);
    const l = setPartners(LINEAGE, "placeholder-elder-b", ["placeholder-elder-a", "placeholder-elder-c"]);
    const ties = l.people.flatMap((p) => p.partners.map((x) => [p.id, x].sort().join("+")));
    expect(new Set(ties).size).toBe(ties.length);
    expect(partnersOf(l, "placeholder-elder-a")).toEqual(["placeholder-elder-b"]);
    expect(partnersOf(l, "placeholder-elder-c")).toEqual(["placeholder-elder-b"]);
    expect(partnersOf(setPartners(l, "placeholder-elder-b", []), "placeholder-elder-a")).toEqual([]);
  });
  it("renaming or removing a place keeps events valid", () => {
    const r = renamePlace(TIMELINE, "placeholder-place-a", "placeholder-place-z");
    expect(r.events.filter((e) => e.placeId === "placeholder-place-z")).toHaveLength(2);
    expect(validateTimeline(r, known)).toEqual([]);
    const gone = removePlace(TIMELINE, "placeholder-place-a");
    expect(gone.events).toHaveLength(TIMELINE.events.length);
    expect(gone.events.some((e) => e.placeId === "placeholder-place-a")).toBe(false);
    expect(validateTimeline(gone, known)).toEqual([]);
    expect(removeEvent(TIMELINE, "placeholder-event-1").events).toHaveLength(TIMELINE.events.length - 1);
  });
});
