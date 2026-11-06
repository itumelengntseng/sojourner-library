import { beforeAll, describe, expect, it } from "vitest";
import { getPitch, PITCHES } from "@/content/pitches";
import { getWorks } from "@/lib/catalogue";
import { isPlausibleToken, kitStatus, lastOpened, loglineWarning, onePager, type PitchKit } from "@/lib/pitch";
import { addUser, asUser, attempt, freshDb, type Db } from "./helpers/db";

const real: PitchKit = { ...getPitch("placeholder-work-one")!, isPlaceholder: false, comparables: ["Comp A meets Comp B"], formats: ["Novel", "Series"], contact: "agent@example.com", sample: "First para.\n\nSecond\nline." };
const work = { title: "Placeholder Work One", author: "Itumeleng Ntseng", words: 14256, readingTime: "1 h 2 min" };

describe("pitch kits", () => {
  it("has a placeholder kit for every work and nothing invented", () => {
    expect(PITCHES.map((p) => p.slug).sort()).toEqual(getWorks().map((w) => w.slug).sort());
    for (const k of PITCHES) {
      expect(k.isPlaceholder).toBe(true);
      expect(k.logline).toMatch(/^Placeholder/);
      expect(k.comparables).toEqual([]);
      expect(k.contact).toBe("");
    }
  });
  it("knows when a kit is ready", () => {
    expect(kitStatus(PITCHES[0])).toEqual({ ready: false, missing: [], placeholder: true });
    expect(kitStatus(real).ready).toBe(true);
    expect(kitStatus({ ...real, synopsis: " ", sample: "" }).missing).toEqual(["synopsis", "sample excerpt"]);
  });
  it("warns about long loglines", () => {
    expect(loglineWarning("short and sweet")).toBeNull();
    expect(loglineWarning("word ".repeat(51))).toMatch(/51 words/);
  });
  it("writes a one-pager with authorship, sample and copyright", () => {
    const md = onePager(real, work);
    expect(md.startsWith("# Placeholder Work One\n\n**by Itumeleng Ntseng**")).toBe(true);
    expect(md).toContain("- Comp A meets Comp B");
    expect(md).toContain("Novel · Series");
    expect(md).toContain("14 256 words");
    expect(md).toContain("> First para.\n");
    expect(md).toContain("> Second line.\n");
    expect(md).toContain("## Contact\n\nagent@example.com");
    expect(md).toContain("© Itumeleng Ntseng");
    expect(onePager(PITCHES[0], work)).toContain("Placeholder pitch");
    expect(onePager(PITCHES[0], work)).not.toContain("## Contact");
  });
  it("says when a link was last opened, in SA time", () => {
    expect(lastOpened(null)).toBe("never opened");
    expect(lastOpened("nonsense")).toBe("never opened");
    expect(lastOpened("2026-11-06T12:32:00Z")).toBe("last opened 6 Nov 2026, 14:32");
  });
  it("checks token shape", () => {
    expect(isPlausibleToken("a".repeat(32))).toBe(true);
    expect(isPlausibleToken("a".repeat(31))).toBe(false);
    expect(isPlausibleToken("../".padEnd(32, "x"))).toBe(false);
  });
});

describe("pitch links", () => {
  const OWNER = "00000000-0000-0000-0000-0000000000a9";
  const GUEST = "00000000-0000-0000-0000-0000000000b9";
  let db: Db;
  const mint = (days = 14, slug = "placeholder-work-one") =>
    asUser(db, OWNER, async (tx) => (await tx.query<{ t: string }>(`select create_pitch_link($1, 'for an agent', $2) as t`, [slug, days])).rows[0].t);
  const open = (tok: string) =>
    asUser(db, null, async (tx) => (await tx.query<{ work_slug: string; title: string | null }>(`select * from open_pitch_link($1)`, [tok])).rows);

  beforeAll(async () => {
    db = await freshDb();
    await addUser(db, OWNER, "owner");
    await addUser(db, GUEST, "guest");
    await db.query(`insert into works (slug, title) values ('placeholder-work-one', 'Placeholder Work One')`);
  }, 30_000);

  it("only the owner can make links; tokens are url-safe and stored hashed", async () => {
    expect(await attempt(db, GUEST, `select create_pitch_link('placeholder-work-one')`)).toMatch(/only the owner/);
    expect(await attempt(db, OWNER, `select create_pitch_link('placeholder-work-one', '', 90)`)).toMatch(/between 1 and 60/);
    const tok = await mint();
    expect(isPlausibleToken(tok)).toBe(true);
    const hashes = (await db.query<{ token_hash: string }>(`select token_hash from pitch_links`)).rows;
    expect(hashes.some((h) => h.token_hash.includes(tok))).toBe(false);
  });

  it("opens for anyone holding the link, counting views, and reveals only the pitch basics", async () => {
    const tok = await mint();
    expect(await open(tok)).toMatchObject([{ work_slug: "placeholder-work-one", title: "Placeholder Work One", author: "Itumeleng Ntseng", word_count: 0, has_kit: false }]);
    await open(tok);
    const v = (await db.query<{ views: number }>(`select views from pitch_links where token_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex')`, [tok])).rows[0];
    expect(v.views).toBe(2);
    expect(await attempt(db, null, `select * from pitch_links`)).toMatch(/permission denied/);
    expect(await attempt(db, null, `select * from works`)).toMatch(/permission denied/);
  });

  it("refuses wrong, revoked and expired links", async () => {
    expect(await open("x".repeat(32))).toEqual([]);
    expect(await open("bad token")).toEqual([]);
    const tok = await mint();
    await asUser(db, OWNER, (tx) => tx.query(`update pitch_links set revoked_at = now() where token_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex')`, [tok]));
    expect(await open(tok)).toEqual([]);
    const old = await mint(1);
    await db.query(`update pitch_links set expires_at = now() - interval '1 minute' where token_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex')`, [old]);
    expect(await open(old)).toEqual([]);
  });

  it("stamps when a link was last opened, readable only by the owner (C20)", async () => {
    const tok = await mint();
    const stamp = () => db.query<{ last_viewed_at: string | null }>(`select last_viewed_at from pitch_links where token_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex')`, [tok]).then((r) => r.rows[0].last_viewed_at);
    expect(await stamp()).toBeNull();
    await open(tok);
    expect(await stamp()).not.toBeNull();
    const seen = await asUser(db, OWNER, async (tx) => (await tx.query<{ last_viewed_at: string | null }>(`select last_viewed_at from pitch_links where last_viewed_at is not null`)).rows.length);
    expect(seen).toBeGreaterThan(0);
    expect(await attempt(db, OWNER, `update pitch_links set last_viewed_at = null`)).toMatch(/permission denied/);
  });

  it("guests can't list or revoke links", async () => {
    expect(await asUser(db, GUEST, async (tx) => (await tx.query(`select * from pitch_links`)).rows.length)).toBe(0);
  });
});

describe("the pitch sheet", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const { PitchSheet } = await import("@/components/PitchSheet");
  it("shows authorship, the placeholder flag and the copyright line; hides an empty contact", () => {
    const html = renderToStaticMarkup(createElement(PitchSheet, { kit: PITCHES[0], work })).replace(/<!-- -->/g, "");
    expect(html).toContain("by Itumeleng Ntseng");
    expect(html).toContain("Placeholder pitch");
    expect(html).toContain("© Itumeleng Ntseng");
    expect(html).not.toContain("Contact");
  });
});
