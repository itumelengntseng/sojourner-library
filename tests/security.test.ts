// Standing RLS / privilege audit (B11). Runs every migration, then inspects the catalogue
// so a future migration that forgets RLS or over-grants fails the build.
import { beforeAll, describe, expect, it } from "vitest";
import { addUser, attempt, freshDb, type Db } from "./helpers/db";

let db: Db;
const rows = async <T>(sql: string) => (await db.query<T>(sql)).rows;

beforeAll(async () => {
  db = await freshDb();
}, 30_000);

describe("security audit", () => {
  it("has row-level security on every table in public", async () => {
    const off = await rows<{ relname: string }>(
      `select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity`);
    expect(off).toEqual([]);
  });

  it("grants the anon role nothing on any table", async () => {
    const g = await rows<{ table_name: string }>(
      `select table_name from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'`);
    expect(g).toEqual([]);
  });

  it("never lets readers delete manuscripts, loans, sessions, readers or invites", async () => {
    const g = await rows<{ table_name: string }>(
      `select table_name from information_schema.role_table_grants
        where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('DELETE', 'TRUNCATE')`);
    expect(g.map((r) => r.table_name).sort()).toEqual(["highlights", "notes"]); // a reader's own annotations only
  });

  it("pins search_path on every security-definer function", async () => {
    const loose = await rows<{ proname: string }>(
      `select proname from pg_proc where pronamespace = 'public'::regnamespace and prosecdef
         and not exists (select 1 from unnest(coalesce(proconfig, '{}')) c where c like 'search_path=%')`);
    expect(loose).toEqual([]);
  });

  it("keeps internal and bootstrap functions out of the API's reach", async () => {
    const callable = await rows<{ proname: string }>(
      `select proname from pg_proc where pronamespace = 'public'::regnamespace
         and proname in ('_mint_invite', 'mint_owner_invite')
         and (has_function_privilege('authenticated', oid, 'execute') or has_function_privilege('anon', oid, 'execute'))`);
    expect(callable).toEqual([]);
  });

  it("refuses anonymous visitors everywhere", async () => {
    for (const t of ["readers", "works", "chapters", "chapter_texts", "loans", "sessions", "notes", "highlights", "invites", "pitch_links", "pitch_kits", "atlas_documents"]) {
      expect(await attempt(db, null, `select * from ${t}`)).toMatch(/permission denied/);
    }
  });

  it("stops a signed-in stranger without a card from seeing or borrowing anything", async () => {
    const STRANGER = "00000000-0000-0000-0000-0000000000e1";
    const OWNER = "00000000-0000-0000-0000-0000000000e2";
    await addUser(db, OWNER, "owner");
    await db.query(`insert into auth.users (id) values ($1)`, [STRANGER]);
    const w = (await rows<{ id: string }>(`insert into works (slug, title, visibility) values ('placeholder-sec', 'P', 'members') returning id`))[0].id;
    const seen = await db.transaction(async (tx) => {
      await tx.query(`select set_config('role', 'authenticated', true)`);
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [STRANGER]);
      return (await tx.query(`select * from works`)).rows.length;
    });
    expect(seen).toBe(0);
    expect(await attempt(db, STRANGER, `insert into loans (work_id, period, due_at) values ($1, 'hour', now())`, [w])).toMatch(/row-level security|foreign key/);
    expect(await attempt(db, STRANGER, `insert into readers (id, role) values ($1, 'owner')`, [STRANGER])).toMatch(/row-level security/);
  });

  it("lets only the owner write the library's own content (QA2)", async () => {
    const owned = ["works", "chapters", "chapter_texts", "pitch_kits", "pitch_links", "atlas_documents"];
    const pols = await rows<{ tablename: string; policyname: string; cmd: string; qual: string | null; with_check: string | null }>(
      `select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'ALL', 'DELETE')`);
    const loose = pols.filter((p) => owned.includes(p.tablename) && ![p.qual, p.with_check].filter(Boolean).every((x) => x!.includes("is_owner()")));
    expect(loose).toEqual([]);
    const G = "00000000-0000-0000-0000-0000000000e9";
    await addUser(db, G, "guest");
    expect(await attempt(db, G, `insert into pitch_kits (work_slug) values ('placeholder-g')`)).toMatch(/row-level security/);
    expect(await attempt(db, G, `insert into atlas_documents (kind, body) values ('lineage', '{}')`)).toMatch(/row-level security/);
    expect(await attempt(db, G, `insert into works (slug, title) values ('placeholder-g', 'G')`)).toMatch(/row-level security/);
  });

  it("reads of chapter text are only for the owner or an open loan (QA2)", async () => {
    const pols = await rows<{ policyname: string; qual: string }>(
      `select policyname, qual from pg_policies where schemaname = 'public' and tablename = 'chapter_texts' and cmd = 'SELECT'`);
    expect(pols.map((p) => p.policyname).sort()).toEqual(["texts_owner_select", "texts_select"]);
    expect(pols.find((p) => p.policyname === "texts_owner_select")!.qual).toBe("is_owner()");
    expect(pols.find((p) => p.policyname === "texts_select")!.qual).toContain("has_active_loan");
  });

  it("keeps authorship on every work", async () => {
    expect(await attempt(db, null, `select 1`)).toBeNull();
    await expect(db.query(`insert into works (slug, title, author) values ('placeholder-x', 'X', 'Someone Else')`)).rejects.toThrow(/check/);
  });
});

describe("reader cards", () => {
  it("lets a reader rename themselves but not reprint their card", async () => {
    const R = "00000000-0000-0000-0000-0000000000e3";
    await addUser(db, R, "guest", "Old name");
    expect(await attempt(db, R, `update readers set display_name = 'New name', wpm_override = 250 where id = $1`, [R])).toBeNull();
    expect(await attempt(db, R, `update readers set card_number = 'AAAAAAAAAA' where id = $1`, [R])).toMatch(/permission denied/);
    expect(await attempt(db, R, `update readers set created_at = now() - interval '9 years' where id = $1`, [R])).toMatch(/permission denied/);
    expect(await attempt(db, R, `update readers set role = 'owner' where id = $1`, [R])).toMatch(/only the owner/);
  });
});
