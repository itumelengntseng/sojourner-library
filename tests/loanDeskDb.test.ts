import { beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, attempt, freshDb, type Db } from "./helpers/db";

const OWNER = "00000000-0000-0000-0000-0000000000c1";
const READER = "00000000-0000-0000-0000-0000000000c2";
const OTHER = "00000000-0000-0000-0000-0000000000c3";

let db: Db;
let work: string;
let chapter: string;

const one = async <T>(id: string, sql: string, params: unknown[] = []) =>
  asUser(db, id, async (tx) => (await tx.query<T>(sql, params)).rows[0]);

/** Back-date a loan as if it had been issued earlier (SQL-editor privileges). */
const backdate = (loanId: string, hours: number) =>
  db.query(
    `update loans set borrowed_at = borrowed_at - make_interval(hours => $2), due_at = due_at - make_interval(hours => $2) where id = $1`,
    [loanId, hours]);

beforeAll(async () => {
  db = await freshDb();
  await addUser(db, OWNER, "owner");
  await addUser(db, READER, "guest");
  await addUser(db, OTHER, "guest");
  const w = await db.query<{ id: string }>(
    `insert into works (slug, title, visibility) values ('placeholder-desk', 'Placeholder Desk Work', 'members') returning id`);
  work = w.rows[0].id;
  chapter = (await db.query<{ id: string }>(
    `insert into chapters (work_id, position, title) values ($1, 1, 'Chapter 1') returning id`, [work])).rows[0].id;
}, 30_000);

describe("loan desk: borrowing", () => {
  it("stamps the dates itself, whatever the reader sends", async () => {
    const loan = await one<{ due_at: Date; borrowed_at: Date; renewals: number }>(READER,
      `insert into loans (work_id, period, borrowed_at, due_at, renewals)
       values ($1, 'evening', now() - interval '9 days', now() + interval '1 year', 2)
       returning borrowed_at, due_at, renewals`, [work]);
    expect(loan.renewals).toBe(0);
    expect(Math.abs(Date.now() - new Date(loan.borrowed_at).getTime())).toBeLessThan(60_000);
    expect(new Date(loan.due_at).getTime() - new Date(loan.borrowed_at).getTime()).toBe(4 * 3600_000);
  });

  it("returns an expired loan to the shelf when the book is borrowed again, carrying the bookmark", async () => {
    const first = await one<{ id: string }>(OTHER,
      `insert into loans (work_id, period, due_at) values ($1, 'hour', now()) returning id`, [work]);
    await asUser(db, OTHER, (tx) =>
      tx.query(`update loans set bookmark_chapter = $2, bookmark_offset = 1200 where id = $1`, [first.id, chapter]));
    await backdate(first.id, 3);

    const again = await one<{ id: string; bookmark_offset: number; bookmark_chapter: string }>(OTHER,
      `insert into loans (work_id, period, due_at) values ($1, 'hour', now()) returning id, bookmark_offset, bookmark_chapter`, [work]);
    expect(again.bookmark_offset).toBe(1200);
    expect(again.bookmark_chapter).toBe(chapter);

    const old = (await db.query<{ returned_at: Date; due_at: Date }>(`select returned_at, due_at from loans where id = $1`, [first.id])).rows[0];
    expect(new Date(old.returned_at).getTime()).toBe(new Date(old.due_at).getTime());
  });
});

describe("loan desk: renewing and returning", () => {
  it("renews by one period from the due date, three times at most", async () => {
    const reader = "00000000-0000-0000-0000-0000000000c4";
    await addUser(db, reader, "guest");
    const loan = await one<{ id: string; due_at: Date }>(reader,
      `insert into loans (work_id, period, due_at) values ($1, 'hour', now()) returning id, due_at`, [work]);
    let due = new Date(loan.due_at).getTime();
    for (let i = 1; i <= 3; i++) {
      const r = await one<{ due_at: Date; renewals: number }>(reader,
        `update loans set renewals = renewals + 1, due_at = now() + interval '10 years' where id = $1 returning due_at, renewals`, [loan.id]);
      expect(r.renewals).toBe(i);
      expect(new Date(r.due_at).getTime() - due).toBe(3600_000);
      due = new Date(r.due_at).getTime();
    }
    expect(await attempt(db, reader, `update loans set renewals = renewals + 1 where id = $1`, [loan.id])).toMatch(/renewal limit/);
  });

  it("refuses to move the due date without renewing", async () => {
    const r = "00000000-0000-0000-0000-0000000000c5";
    await addUser(db, r, "guest");
    const loan = await one<{ id: string }>(r, `insert into loans (work_id, period, due_at) values ($1, 'hour', now()) returning id`, [work]);
    expect(await attempt(db, r, `update loans set due_at = due_at + interval '1 day' where id = $1`, [loan.id])).toMatch(/stamped by the desk/);
    expect(await attempt(db, r, `update loans set borrowed_at = now() - interval '1 day' where id = $1`, [loan.id])).toMatch(/as it was issued/);
    expect(await attempt(db, r, `update loans set renewals = 3 where id = $1`, [loan.id])).toMatch(/one period at a time/);
  });

  it("refuses to renew an expired loan", async () => {
    const r = "00000000-0000-0000-0000-0000000000c6";
    await addUser(db, r, "guest");
    const loan = await one<{ id: string }>(r, `insert into loans (work_id, period, due_at) values ($1, 'hour', now()) returning id`, [work]);
    await backdate(loan.id, 2);
    expect(await attempt(db, r, `update loans set renewals = renewals + 1 where id = $1`, [loan.id])).toMatch(/expired/);
  });

  it("returns a book early, and a returned book stays returned", async () => {
    const r = "00000000-0000-0000-0000-0000000000c7";
    await addUser(db, r, "guest");
    const loan = await one<{ id: string }>(r, `insert into loans (work_id, period, due_at) values ($1, 'two_weeks', now()) returning id`, [work]);
    const back = await one<{ returned_at: Date }>(r,
      `update loans set returned_at = now() + interval '5 days' where id = $1 returning returned_at`, [loan.id]);
    expect(Math.abs(new Date(back.returned_at).getTime() - Date.now())).toBeLessThan(60_000);
    expect(await attempt(db, r, `update loans set returned_at = null where id = $1`, [loan.id])).toMatch(/has been returned/);
    expect(await attempt(db, r, `update loans set renewals = 1 where id = $1`, [loan.id])).toMatch(/has been returned/);
  });

  it("settles only the caller's expired loans on return_expired_loans()", async () => {
    const a = "00000000-0000-0000-0000-0000000000c8";
    const b = "00000000-0000-0000-0000-0000000000c9";
    await addUser(db, a, "guest");
    await addUser(db, b, "guest");
    const la = await one<{ id: string }>(a, `insert into loans (work_id, period, due_at) values ($1, 'hour', now()) returning id`, [work]);
    const lb = await one<{ id: string }>(b, `insert into loans (work_id, period, due_at) values ($1, 'hour', now()) returning id`, [work]);
    await backdate(la.id, 2);
    await backdate(lb.id, 2);
    expect((await one<{ n: number }>(a, `select return_expired_loans() as n`)).n).toBe(1);
    const rows = (await db.query<{ id: string; returned_at: Date | null }>(
      `select id, returned_at from loans where id in ($1, $2)`, [la.id, lb.id])).rows;
    expect(rows.find((x) => x.id === la.id)!.returned_at).not.toBeNull();
    expect(rows.find((x) => x.id === lb.id)!.returned_at).toBeNull();
  });

  it("cannot touch another reader's loan", async () => {
    const loan = (await db.query<{ id: string }>(`select id from loans where reader_id = $1 limit 1`, [READER])).rows[0];
    await asUser(db, OTHER, async (tx) => {
      const r = await tx.query(`update loans set returned_at = now() where id = $1`, [loan.id]);
      expect(r.affectedRows ?? 0).toBe(0);
    });
  });
});
