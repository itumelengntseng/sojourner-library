import { beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, attempt, freshDb, type Db } from "./helpers/db";

const OWNER = "00000000-0000-0000-0000-0000000000a1";
const NEWBIE = "00000000-0000-0000-0000-0000000000b1";
const LATE = "00000000-0000-0000-0000-0000000000b2";
const GUEST = "00000000-0000-0000-0000-0000000000b3";

let db: Db;
const signUp = (id: string) => db.query(`insert into auth.users (id) values ($1)`, [id]);
const mint = async (asId: string, note = "for a friend", days = 14) =>
  asUser(db, asId, async (tx) =>
    (await tx.query<{ code: string }>(`select create_invite($1, $2) as code`, [note, days])).rows[0].code);

beforeAll(async () => {
  db = await freshDb();
  await addUser(db, OWNER, "owner");
  await addUser(db, GUEST, "guest");
  await signUp(NEWBIE);
  await signUp(LATE);
}, 30_000);

describe("owner bootstrap", () => {
  it("mints an owner invite only from the SQL editor, never the API", async () => {
    const code = (await db.query<{ c: string }>(`select mint_owner_invite() as c`)).rows[0].c;
    expect(code).toMatch(/^SOJ-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(await attempt(db, GUEST, `select mint_owner_invite()`)).toMatch(/permission denied/);
    expect(await attempt(db, null, `select mint_owner_invite()`)).toMatch(/permission denied/);
  });
});

describe("invites", () => {
  it("lets only the owner issue invites", async () => {
    expect(await mint(OWNER)).toMatch(/^SOJ-/);
    expect(await attempt(db, GUEST, `select create_invite('x', 7)`)).toMatch(/only the owner/);
  });

  it("never stores the plain code", async () => {
    const code = await mint(OWNER);
    const rows = (await db.query<{ code_hash: string }>(`select code_hash from invites`)).rows;
    expect(rows.some((r) => r.code_hash.includes(code.replace(/-/g, "")))).toBe(false);
  });

  it("issues a guest card on redemption, forgiving case and spacing", async () => {
    const code = await mint(OWNER);
    const messy = ` ${code.toLowerCase().replace(/-/g, " ")} `;
    const card = await asUser(db, NEWBIE, async (tx) =>
      (await tx.query<{ role: string; display_name: string; card_number: string }>(
        `select * from redeem_invite($1, 'Thandi')`, [messy])).rows[0]);
    expect(card.role).toBe("guest");
    expect(card.display_name).toBe("Thandi");
    expect(card.card_number).toMatch(/^[0-9A-F]{10}$/);
  });

  it("refuses a second card for the same person", async () => {
    const code = await mint(OWNER);
    expect(await attempt(db, NEWBIE, `select redeem_invite($1)`, [code])).toMatch(/already hold/);
  });

  it("refuses a used code", async () => {
    const code = await mint(OWNER);
    const someone = "00000000-0000-0000-0000-0000000000b9";
    await signUp(someone);
    expect(await attempt(db, someone, `select redeem_invite($1)`, [code])).toBeNull();
    expect(await attempt(db, LATE, `select redeem_invite($1)`, [code])).toMatch(/already been used/);
  });

  it("refuses expired and revoked codes", async () => {
    const expired = await mint(OWNER);
    await db.query(`update invites set expires_at = now() - interval '1 minute' where code_hash = hash_invite_code($1)`, [expired]);
    expect(await attempt(db, LATE, `select redeem_invite($1)`, [expired])).toMatch(/expired/);

    const revoked = await mint(OWNER);
    await asUser(db, OWNER, (tx) =>
      tx.query(`update invites set revoked_at = now() where code_hash = hash_invite_code($1)`, [revoked]));
    expect(await attempt(db, LATE, `select redeem_invite($1)`, [revoked])).toMatch(/not recognised/);
  });

  it("refuses made-up codes and signed-out visitors", async () => {
    expect(await attempt(db, LATE, `select redeem_invite('SOJ-0000-0000-0000')`)).toMatch(/not recognised/);
    expect(await attempt(db, null, `select redeem_invite('SOJ-0000-0000-0000')`)).toMatch(/permission denied/);
  });

  it("caps invite lifetime", async () => {
    expect(await attempt(db, OWNER, `select create_invite('x', 365)`)).toMatch(/between 1 and 90/);
  });

  it("hides the invite list from guests", async () => {
    await asUser(db, GUEST, async (tx) => {
      expect((await tx.query(`select * from invites`)).rows).toHaveLength(0);
    });
  });
});
