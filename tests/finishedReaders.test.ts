import { beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, attempt, freshDb, type Db } from "./helpers/db";

// C45: finished_readers() — how many guest readers reached the end of each work (counts only).
describe("finished_readers()", () => {
  const OWNER = "00000000-0000-0000-0000-0000000000a1";
  const G1 = "00000000-0000-0000-0000-0000000000a2";
  const G2 = "00000000-0000-0000-0000-0000000000a3";
  const G3 = "00000000-0000-0000-0000-0000000000a4";
  let db: Db;
  let work: string;
  let last: string;
  let first: string;

  const session = (reader: string, chapter: string, words: number) =>
    db.query(`insert into sessions (reader_id, work_id, chapter_id, started_at, ended_at, words_read) values ($1, $2, $3, now() - interval '10 min', now(), $4)`, [reader, work, chapter, words]);
  const counts = async (who: string) =>
    asUser(db, who, async (tx) => (await tx.query<{ work_id: string; finished: number | string }>(`select * from finished_readers()`)).rows);

  beforeAll(async () => {
    db = await freshDb();
    await addUser(db, OWNER, "owner");
    for (const g of [G1, G2, G3]) await addUser(db, g, "guest");
    const chapters = JSON.stringify([{ title: "Chapter 1", body: "Placeholder.", words: 100 }, { title: "Chapter 2", body: "Placeholder.", words: 100 }]);
    work = await asUser(db, OWNER, async (tx) => (await tx.query<{ id: string }>(`select import_manuscript('placeholder-finish', 'Placeholder Finish', $1::jsonb, 'draft') as id`, [chapters])).rows[0].id);
    const ch = (await db.query<{ id: string; position: number }>(`select id, position from chapters where work_id = $1 order by position`, [work])).rows;
    first = ch[0].id;
    last = ch[1].id;
  }, 30_000);

  it("counts guests whose sessions reach 90% of the last chapter, across sessions", async () => {
    await session(G1, last, 95); // one sitting
    await session(G2, last, 50);
    await session(G2, last, 40); // two sittings → 90
    await session(G3, last, 89); // not quite
    await session(G3, first, 100); // the first chapter doesn't count
    await session(OWNER, last, 100); // the Keeper isn't a reader here
    const rows = await counts(OWNER);
    expect(Number(rows.find((r) => r.work_id === work)?.finished)).toBe(2);
  });

  it("follows the last shelved chapter when chapters are set aside", async () => {
    await db.query(`update chapters set archived_at = now() where id = $1`, [last]);
    expect(Number((await counts(OWNER)).find((r) => r.work_id === work)?.finished)).toBe(1); // only G3 read chapter 1 through
    await db.query(`update chapters set archived_at = null where id = $1`, [last]);
  });

  it("is the owner's alone: guests get nothing, anon can't call it", async () => {
    expect(await counts(G1)).toEqual([]);
    expect(await attempt(db, null, `select * from finished_readers()`)).toMatch(/permission denied/);
  });

  it("names nobody — only work ids and counts come back", async () => {
    const cols = Object.keys((await counts(OWNER))[0]);
    expect(cols.sort()).toEqual(["finished", "work_id"]);
  });
});
