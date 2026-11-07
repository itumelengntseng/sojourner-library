import { beforeAll, describe, expect, it } from "vitest";
import { HALLS, hallsFor } from "@/lib/catalogue";
import { checkHall, hallsFromRows } from "@/lib/catalogueRows";
import { addUser, asUser, attempt, freshDb, type Db } from "./helpers/db";

describe("named halls", () => {
  it("uses the placeholder hall until the author names any", () => {
    expect(hallsFromRows([])).toEqual([...HALLS]);
  });
  it("orders the author's halls and keeps works in unknown halls visible", () => {
    const named = hallsFromRows([
      { id: "b-hall", name: " Placeholder B ", note: null, position: 2 },
      { id: "a-hall", name: "Placeholder A", note: "Placeholder note", position: 1 },
    ]);
    expect(named).toEqual([{ id: "a-hall", name: "Placeholder A", note: "Placeholder note" }, { id: "b-hall", name: "Placeholder B", note: "" }]);
    expect(hallsFor([{ hall: "main" }, { hall: "a-hall" }], named).map((h) => h.id)).toEqual(["a-hall", "b-hall", "main"]);
  });
  it("checks names, notes and order", () => {
    expect(checkHall("  ", "")).toMatchObject({ ok: false });
    expect(checkHall("x".repeat(81), "")).toMatchObject({ ok: false });
    expect(checkHall("Placeholder  Hall", " a  note ", "5000")).toEqual({ ok: true, name: "Placeholder Hall", note: "a note", position: 999 });
    expect(checkHall("P", "", "nope")).toMatchObject({ ok: true, position: 0 });
  });
});

describe("halls table", () => {
  const OWNER = "00000000-0000-0000-0000-0000000000b1";
  const GUEST = "00000000-0000-0000-0000-0000000000b2";
  let db: Db;
  beforeAll(async () => {
    db = await freshDb();
    await addUser(db, OWNER, "owner");
    await addUser(db, GUEST, "guest");
  }, 30_000);
  it("the owner names and renames halls; card holders read them", async () => {
    await asUser(db, OWNER, (tx) => tx.query(`insert into halls (id, name) values ('placeholder-east', 'Placeholder East')`));
    await asUser(db, OWNER, (tx) => tx.query(`update halls set name = 'Placeholder East Hall', position = 1 where id = 'placeholder-east'`));
    const seen = await asUser(db, GUEST, async (tx) => (await tx.query<{ name: string }>(`select name from halls`)).rows);
    expect(seen).toEqual([{ name: "Placeholder East Hall" }]);
  });
  it("guests can't name halls; anon sees nothing; nobody removes one", async () => {
    expect(await attempt(db, GUEST, `insert into halls (id, name) values ('x', 'X')`)).toMatch(/row-level security/);
    expect(await asUser(db, GUEST, async (tx) => (await tx.query(`update halls set name = 'X' returning id`)).rows.length)).toBe(0);
    expect(await attempt(db, null, `select * from halls`)).toMatch(/permission denied/);
    expect(await attempt(db, OWNER, `delete from halls`)).toMatch(/permission denied/);
  });
  it("rejects bad addresses and empty names; works need a well-formed hall", async () => {
    expect(await attempt(db, OWNER, `insert into halls (id, name) values ('Bad Id', 'X')`)).toMatch(/check constraint/);
    expect(await attempt(db, OWNER, `insert into halls (id, name) values ('ok', '  ')`)).toMatch(/check constraint/);
    await expect(db.query(`insert into works (slug, title, hall) values ('placeholder-h', 'H', 'Not OK')`)).rejects.toThrow(/check/);
    await db.query(`insert into works (slug, title, hall) values ('placeholder-h', 'H', 'placeholder-east')`);
  });
});

describe("C55 hall summary", async () => {
  const { hallSummary } = await import("@/lib/workStats");
  const { getWorks } = await import("@/lib/catalogue");
  const works = getWorks();
  it("counts works and reading time at the given pace", () => {
    const one = hallSummary(works.slice(0, 1), 230);
    expect(one).toMatch(/^1 work · about .+ to read at a usual pace$/);
    expect(hallSummary(works, 230, true)).toMatch(new RegExp(`^${works.length} works · about .+ at your pace$`));
  });
  it("a faster pace means less time; empty shelf says nothing", () => {
    const mins = (s: string) => { const m = s.match(/about (?:(\d+) h)? ?(?:(\d+) min)?/)!; return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0); };
    expect(mins(hallSummary(works, 460))).toBeLessThan(mins(hallSummary(works, 230)));
    expect(hallSummary([], 230)).toBe("");
  });
});
