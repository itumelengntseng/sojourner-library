import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_WPM, personalWpm, personalWpmFromStats, activeMs } from "@/lib/engine/readingTime";
import { capWords, paceFrom, paceNote, parseSessionPayload, parseStoredStats, toStats, upsertStats } from "@/lib/sessions";
import { addUser, asUser, attempt, freshDb, type Db } from "./helpers/db";

const NOW = Date.UTC(2026, 10, 6, 18, 0);
const ID = "3f2b8c1e-5a4d-4e6f-9a1b-2c3d4e5f6a7b";
const good = { sessionId: ID, slug: "placeholder-work-one", position: 2, startedAt: NOW - 20 * 60_000, activity: [NOW - 60_000, NOW - 20 * 60_000, NOW - 10 * 60_000], wordsRead: 900 };

describe("session payloads", () => {
  it("accepts a well-formed session and sorts its activity", () => {
    const p = parseSessionPayload(good, NOW)!;
    expect(p.activity).toEqual([NOW - 20 * 60_000, NOW - 10 * 60_000, NOW - 60_000]);
  });
  it("rejects bad ids, slugs, positions and word counts", () => {
    for (const bad of [
      { ...good, sessionId: "x" }, { ...good, slug: "../etc" }, { ...good, position: 0 },
      { ...good, wordsRead: -1 }, { ...good, wordsRead: 1.5 }, { ...good, activity: "no" }, null, "str",
    ]) expect(parseSessionPayload(bad, NOW)).toBeNull();
  });
  it("rejects stale or future sessions and drops stray timestamps", () => {
    expect(parseSessionPayload({ ...good, startedAt: NOW - 13 * 3600_000 }, NOW)).toBeNull();
    expect(parseSessionPayload({ ...good, startedAt: NOW + 5 * 60_000 }, NOW)).toBeNull();
    const p = parseSessionPayload({ ...good, activity: [NOW - 30 * 60_000, NOW + 3600_000, NOW - 5 * 60_000, "x"] }, NOW)!;
    expect(p.activity).toEqual([NOW - 5 * 60_000]);
  });
  it("caps words at the chapter's length", () => {
    expect(capWords(parseSessionPayload(good, NOW)!, 500).wordsRead).toBe(500);
  });
});

describe("pace", () => {
  it("summarised stats give the same speed as raw sessions", () => {
    const sessions = [
      { wordsRead: 2000, activity: Array.from({ length: 11 }, (_, i) => NOW - 3 * 86_400_000 + i * 60_000), endedAt: NOW - 3 * 86_400_000 + 600_000 },
      { wordsRead: 1500, activity: Array.from({ length: 6 }, (_, i) => NOW + i * 60_000), endedAt: NOW + 300_000 },
    ];
    const stats = sessions.map((s) => ({ wordsRead: s.wordsRead, activeMs: activeMs(s.activity), endedAt: s.endedAt }));
    expect(personalWpmFromStats(stats)).toBe(personalWpm(sessions));
    expect(personalWpm(sessions)).toBeGreaterThan(200);
  });
  it("learns from sessions, defaults without them, and honours a chosen pace", () => {
    expect(paceFrom([])).toEqual({ wpm: DEFAULT_WPM, source: "default", sessions: 0, minutesPerDay: 30 });
    const learned = paceFrom([{ wordsRead: 3000, activeMs: 10 * 60_000, endedAt: NOW }]);
    expect(learned).toMatchObject({ wpm: 300, source: "learned" });
    expect(paceNote(learned)).toMatch(/300 wpm, learned/);
    expect(paceFrom([], 180)).toMatchObject({ wpm: 180, source: "set" });
    expect(paceNote(paceFrom([]))).toMatch(/until we learn your pace/);
  });
  it("turns a payload into stats ending at the last activity", () => {
    const activity = [NOW - 4 * 60_000, NOW - 3 * 60_000, NOW - 2 * 60_000, NOW - 60_000];
    const s = toStats(parseSessionPayload({ ...good, activity }, NOW)!);
    expect(s).toEqual({ wordsRead: 900, activeMs: 3 * 60_000, endedAt: NOW - 60_000 });
  });
});

describe("preview session cookie", () => {
  it("upserts heartbeats by id, newest first, and drops junk", () => {
    let list = upsertStats([], { id: "a", wordsRead: 10, activeMs: 1, endedAt: 1 });
    list = upsertStats(list, { id: "b", wordsRead: 10, activeMs: 1, endedAt: 5 });
    list = upsertStats(list, { id: "a", wordsRead: 99, activeMs: 2, endedAt: 9 });
    expect(list.map((s) => [s.id, s.wordsRead])).toEqual([["a", 99], ["b", 10]]);
    expect(parseStoredStats(JSON.stringify([...list, { id: "c", wordsRead: -4, activeMs: 1, endedAt: 1 }]))).toHaveLength(2);
    expect(parseStoredStats("{")).toEqual([]);
  });
});

describe("sessions table", () => {
  const OWNER = "00000000-0000-0000-0000-0000000000d1";
  const READER = "00000000-0000-0000-0000-0000000000d2";
  let db: Db;
  let work: string;
  beforeAll(async () => {
    db = await freshDb();
    await addUser(db, OWNER, "owner");
    await addUser(db, READER, "guest");
    work = (await db.query<{ id: string }>(`insert into works (slug, title, visibility) values ('placeholder-s', 'P', 'members') returning id`)).rows[0].id;
  }, 30_000);

  it("refuses a session without a loan, accepts one during a loan, and upserts heartbeats", async () => {
    const ins = `insert into sessions (id, work_id, words_read) values ('${ID}', $1, $2)
                 on conflict (id) do update set words_read = excluded.words_read`;
    expect(await attempt(db, READER, ins, [work, 10])).toMatch(/row-level security/);
    await asUser(db, READER, (tx) => tx.query(`insert into loans (work_id, period, due_at) values ($1, 'hour', now())`, [work]));
    expect(await attempt(db, READER, ins, [work, 10])).toBeNull();
    expect(await attempt(db, READER, ins, [work, 250])).toBeNull();
    const rows = (await db.query<{ words_read: number }>(`select words_read from sessions where id = $1`, [ID])).rows;
    expect(rows).toEqual([{ words_read: 250 }]);
  });

  it("bounds activity and words", async () => {
    expect(await attempt(db, READER, `update sessions set words_read = 600000 where id = $1`, [ID])).toMatch(/sessions_words_cap/);
    expect(await attempt(db, READER,
      `update sessions set activity = array(select now() from generate_series(1, 2001)) where id = $1`, [ID])).toMatch(/sessions_activity_cap/);
  });

  it("lets the owner read sessions for the ledger but not write them", async () => {
    const n = await asUser(db, OWNER, async (tx) => (await tx.query(`select * from sessions`)).rows.length);
    expect(n).toBe(1);
    await asUser(db, OWNER, async (tx) => {
      const r = await tx.query(`update sessions set words_read = 1 where id = $1`, [ID]);
      expect(r.affectedRows ?? 0).toBe(0);
    });
  });
});
