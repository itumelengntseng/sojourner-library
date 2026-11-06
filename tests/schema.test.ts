import { beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, attempt, freshDb, type Db } from "./helpers/db";

const OWNER = "00000000-0000-0000-0000-00000000000a";
const GUEST = "00000000-0000-0000-0000-00000000000b";
const OTHER = "00000000-0000-0000-0000-00000000000c";

let db: Db;
let sharedWork: string;
let privateWork: string;
let chapter: string;

beforeAll(async () => {
  db = await freshDb();
  await addUser(db, OWNER, "owner", "Itu");
  await addUser(db, GUEST, "guest", "Guest");
  await addUser(db, OTHER, "guest", "Other");
  await asUser(db, OWNER, async (tx) => {
    const w1 = await tx.query<{ id: string }>(
      `insert into works (slug, title, visibility) values ('placeholder-one', 'Placeholder Work One', 'members') returning id`);
    const w2 = await tx.query<{ id: string }>(
      `insert into works (slug, title) values ('placeholder-two', 'Placeholder Work Two') returning id`);
    sharedWork = w1.rows[0].id;
    privateWork = w2.rows[0].id;
    const c = await tx.query<{ id: string }>(
      `insert into chapters (work_id, position, title, word_count) values ($1, 1, 'Chapter One', 4) returning id`, [sharedWork]);
    chapter = c.rows[0].id;
    await tx.query(`insert into chapter_texts (chapter_id, body_md) values ($1, 'Placeholder text only.')`, [chapter]);
  });
}, 30_000);

const count = async (tx: Db, sql: string, params: unknown[] = []) =>
  (await tx.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params)).rows[0].n;

describe("authorship", () => {
  it("defaults every work to Itumeleng Ntseng", async () => {
    const r = await db.query<{ author: string }>(`select author from works`);
    expect(r.rows.every((w) => w.author === "Itumeleng Ntseng")).toBe(true);
  });
  it("rejects a work credited to anyone else", async () => {
    await expect(db.query(`insert into works (slug, title, author) values ('x', 'X', 'Someone Else')`)).rejects.toThrow();
  });
});

describe("row-level security", () => {
  it("shows anonymous visitors nothing", async () => {
    expect(await attempt(db, null, `select * from works`)).toMatch(/permission denied/);
  });

  it("lets guests see shared works but not the owner's private ones", async () => {
    await asUser(db, GUEST, async (tx) => {
      expect(await count(tx, `select * from works`)).toBe(1);
      expect(await count(tx, `select * from works where id = $1`, [privateWork])).toBe(0);
      expect(await count(tx, `select * from chapters`)).toBe(1);
    });
  });

  it("lets the owner see everything", async () => {
    await asUser(db, OWNER, async (tx) => {
      expect(await count(tx, `select * from works`)).toBe(2);
      expect(await count(tx, `select * from readers`)).toBe(3);
    });
  });

  it("stops guests writing to the catalogue", async () => {
    expect(await attempt(db, GUEST, `insert into works (slug, title) values ('g', 'g')`)).toMatch(/row-level security/);
    await asUser(db, GUEST, async (tx) => {
      const r = await tx.query(`update works set title = 'Hacked' where id = $1`, [sharedWork]);
      expect(r.affectedRows).toBe(0);
    });
  });

  it("never lets anyone delete manuscripts through the API", async () => {
    expect(await attempt(db, OWNER, `delete from works where id = $1`, [sharedWork])).toMatch(/permission denied/);
    expect(await attempt(db, OWNER, `delete from chapter_texts`)).toMatch(/permission denied/);
    expect(await count(db, `select * from works`)).toBe(2);
  });

  it("hides chapter text until the guest has an active loan", async () => {
    await asUser(db, GUEST, async (tx) => {
      expect(await count(tx, `select * from chapter_texts`)).toBe(0);
      await tx.query(`insert into loans (work_id, period, due_at) values ($1, 'evening', now() + interval '4 hours')`, [sharedWork]);
      expect(await count(tx, `select * from chapter_texts`)).toBe(1);
    });
  });

  it("closes the text again once the loan expires", async () => {
    // Back-dated loans can only be written from the SQL editor (the desk stamps API loans with now()).
    await db.query(
      `insert into loans (reader_id, work_id, period, borrowed_at, due_at) values ($1, $2, 'hour', now() - interval '2 hours', now() - interval '1 hour')`,
      [OTHER, sharedWork]);
    await asUser(db, OTHER, async (tx) => {
      expect(await count(tx, `select * from chapter_texts`)).toBe(0);
    });
  });

  it("refuses loans on works a guest cannot see", async () => {
    expect(await attempt(db, GUEST,
      `insert into loans (work_id, period, due_at) values ($1, 'hour', now() + interval '1 hour')`, [privateWork],
    )).toMatch(/row-level security/);
  });

  it("allows only one open loan per book", async () => {
    const fresh = "00000000-0000-0000-0000-00000000000d";
    await addUser(db, fresh, "guest");
    const sql = `insert into loans (work_id, period, due_at) values ($1, 'hour', now() + interval '1 hour')`;
    expect(await attempt(db, fresh, sql, [sharedWork])).toBeNull();
    expect(await attempt(db, fresh, sql, [sharedWork])).toMatch(/duplicate key/);
  });

  it("keeps notes and highlights private to the reader, even from the owner", async () => {
    await asUser(db, GUEST, async (tx) => {
      await tx.query(`insert into notes (work_id, chapter_id, body) values ($1, $2, 'my note')`, [sharedWork, chapter]);
      await tx.query(`insert into highlights (work_id, chapter_id, start_offset, end_offset) values ($1, $2, 0, 5)`, [sharedWork, chapter]);
    });
    await asUser(db, OTHER, async (tx) => {
      expect(await count(tx, `select * from notes`)).toBe(0);
      expect(await count(tx, `select * from highlights`)).toBe(0);
    });
    await asUser(db, OWNER, async (tx) => {
      expect(await count(tx, `select * from notes`)).toBe(0);
    });
    await asUser(db, GUEST, async (tx) => {
      expect(await count(tx, `select * from notes`)).toBe(1);
    });
  });

  it("stops a guest from writing notes in someone else's name", async () => {
    expect(await attempt(db, GUEST,
      `insert into notes (reader_id, work_id, chapter_id, body) values ($1, $2, $3, 'x')`, [OTHER, sharedWork, chapter],
    )).toMatch(/row-level security/);
  });

  it("stops guests promoting themselves to owner", async () => {
    expect(await attempt(db, GUEST, `update readers set role = 'owner' where id = $1`, [GUEST])).toMatch(/only the owner/);
  });

  it("lets readers see only their own card", async () => {
    await asUser(db, GUEST, async (tx) => {
      expect(await count(tx, `select * from readers`)).toBe(1);
    });
  });
});
