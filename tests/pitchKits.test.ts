import { beforeAll, describe, expect, it } from "vitest";
import { getPitch } from "@/content/pitches";
import { blankKit, chooseKit, kitFromForm, kitFromRow, kitStatus, kitToRow, parseList, sharedPitch, KIT_LIMITS } from "@/lib/pitch";
import { addUser, asUser, attempt, freshDb, type Db } from "./helpers/db";

const form = (o: Record<string, string>) => (n: string) => o[n] ?? null;

describe("editing a pitch kit", () => {
  it("reads lists one per line, or by commas, without blanks or repeats", () => {
    expect(parseList("Novel\n\n series \nNovel")).toEqual(["Novel", "series"]);
    expect(parseList("novel, film")).toEqual(["novel", "film"]);
    expect(parseList("")).toEqual([]);
  });
  it("builds a kit from the form; it stays a placeholder unless the author ticks own words", () => {
    const r = kitFromForm("placeholder-work-one", form({ logline: "  Placeholder logline. ", themes: "A\nB", sample: "Placeholder.\r\n\r\nTwo." }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.kit).toMatchObject({ slug: "placeholder-work-one", isPlaceholder: true, logline: "Placeholder logline.", themes: ["A", "B"], sample: "Placeholder.\n\nTwo.", contact: "" });
    const own = kitFromForm("placeholder-work-one", form({ ownWords: "on" }));
    expect(own.ok && own.kit.isPlaceholder).toBe(false);
  });
  it("refuses over-long fields, long lists and bad addresses", () => {
    const r = kitFromForm("Bad Slug", form({ logline: "x".repeat(KIT_LIMITS.logline + 1), themes: Array.from({ length: 13 }, (_, i) => `t${i}`).join("\n") }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join(" ")).toMatch(/work address/);
    expect(r.errors.join(" ")).toMatch(/logline is 601/);
    expect(r.errors.join(" ")).toMatch(/12 or fewer/);
  });
  it("round-trips through a database row", () => {
    const k = getPitch("placeholder-work-one")!;
    expect(kitFromRow(kitToRow(k))).toEqual(k);
  });
  it("prefers the stored kit, then the file kit, then an empty one (never invented)", () => {
    const file = getPitch("placeholder-work-one")!;
    const stored = { ...file, logline: "Stored placeholder." };
    expect(chooseKit("placeholder-work-one", stored, file).logline).toBe("Stored placeholder.");
    expect(chooseKit("placeholder-work-one", undefined, file)).toBe(file);
    const blank = chooseKit("new-work", undefined, undefined);
    expect(blank).toEqual(blankKit("new-work"));
    expect(kitStatus(blank)).toMatchObject({ ready: false, placeholder: true });
    expect(Object.values(blank).filter((v) => typeof v === "string" && v && v !== "new-work")).toEqual([]);
  });
  it("shared view uses the stored kit when there is one and keeps authorship", () => {
    const base = { work_slug: "w", title: "W", author: null, word_count: 460 };
    expect(sharedPitch({ ...base, has_kit: false }, undefined).kit).toEqual(blankKit("w"));
    const s = sharedPitch({ ...base, has_kit: true, ...kitToRow({ ...blankKit("w"), logline: "Placeholder L." }), work_slug: "w" }, undefined);
    expect(s.kit.logline).toBe("Placeholder L.");
    expect(s.work).toEqual({ title: "W", author: "Itumeleng Ntseng", words: 460, readingTime: "2 min" });
  });
});

describe("pitch_kits table", () => {
  const OWNER = "00000000-0000-0000-0000-0000000000d1";
  const GUEST = "00000000-0000-0000-0000-0000000000d2";
  let db: Db;
  const upsert = `insert into pitch_kits (work_slug, logline, themes) values ($1, $2, $3)
                  on conflict (work_slug) do update set logline = excluded.logline, themes = excluded.themes`;

  beforeAll(async () => {
    db = await freshDb();
    await addUser(db, OWNER, "owner");
    await addUser(db, GUEST, "guest");
    await db.query(`insert into works (slug, title) values ('placeholder-kit', 'Placeholder Kit')`);
  }, 30_000);

  it("lets the owner save and update a kit", async () => {
    await asUser(db, OWNER, (tx) => tx.query(upsert, ["placeholder-kit", "Placeholder one.", ["A"]]));
    await asUser(db, OWNER, (tx) => tx.query(upsert, ["placeholder-kit", "Placeholder two.", ["A", "B"]]));
    const rows = await asUser(db, OWNER, async (tx) => (await tx.query<{ logline: string; themes: string[]; is_placeholder: boolean }>(`select logline, themes, is_placeholder from pitch_kits`)).rows);
    expect(rows).toEqual([{ logline: "Placeholder two.", themes: ["A", "B"], is_placeholder: true }]);
  });
  it("keeps kits from guests and anon, and nobody can delete one", async () => {
    expect(await asUser(db, GUEST, async (tx) => (await tx.query(`select * from pitch_kits`)).rows.length)).toBe(0);
    expect(await attempt(db, GUEST, upsert, ["placeholder-kit", "Hijack", []])).toMatch(/row-level security/);
    expect(await attempt(db, null, `select * from pitch_kits`)).toMatch(/permission denied/);
    expect(await attempt(db, OWNER, `delete from pitch_kits`)).toMatch(/permission denied/);
  });
  it("rejects over-long fields and bad slugs at the database too", async () => {
    expect(await attempt(db, OWNER, upsert, ["Bad Slug", "x", []])).toMatch(/check constraint/);
    expect(await attempt(db, OWNER, upsert, ["placeholder-kit", "x".repeat(601), []])).toMatch(/check constraint/);
  });
  it("a live share link carries the stored kit to someone without a card", async () => {
    const tok = await asUser(db, OWNER, async (tx) => (await tx.query<{ t: string }>(`select create_pitch_link('placeholder-kit') as t`)).rows[0].t);
    const rows = await asUser(db, null, async (tx) => (await tx.query(`select * from open_pitch_link($1)`, [tok])).rows);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ work_slug: "placeholder-kit", has_kit: true, logline: "Placeholder two.", themes: ["A", "B"], author: "Itumeleng Ntseng" });
  });
});
