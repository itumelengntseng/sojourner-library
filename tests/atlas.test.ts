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
