import { beforeAll, describe, expect, it } from "vitest";
import { parseManuscript, slugify } from "@/lib/manuscript";
import { addUser, asUser, attempt, freshDb, type Db } from "./helpers/db";

describe("manuscript parsing", () => {
  it("uses a lone # title and ## chapters", () => {
    const m = parseManuscript("# Placeholder Book\n\n## One\n\nalpha beta\n\n## Two\n\ngamma\n");
    expect(m.title).toBe("Placeholder Book");
    expect(m.chapters.map((c) => [c.position, c.title, c.words])).toEqual([[1, "One", 2], [2, "Two", 1]]);
    expect(m.words).toBe(3);
    expect(m.warnings).toEqual([]);
  });
  it("treats every # heading as a chapter when there are several", () => {
    const m = parseManuscript("# A\ntext one\n# B\ntext two two");
    expect(m.title).toBeNull();
    expect(m.chapters.map((c) => c.title)).toEqual(["A", "B"]);
  });
  it("strips front matter and a BOM, normalises line endings", () => {
    const m = parseManuscript("﻿---\nauthor: x\n---\n## One\r\nwords here\r\n");
    expect(m.chapters[0]).toMatchObject({ title: "One", body: "words here" });
  });
  it("warns about headless text, empty chapters and preamble", () => {
    expect(parseManuscript("just some words").warnings[0]).toMatch(/No chapter headings/);
    const m = parseManuscript("preamble\n## Empty\n## Full\ntext");
    expect(m.warnings.join(" ")).toMatch(/before the first chapter/);
    expect(m.warnings.join(" ")).toMatch(/"Empty" has no text/);
    expect(parseManuscript("   ").chapters).toEqual([]);
  });
  it("makes clean slugs", () => {
    expect(slugify("Placeholder: The Book’s Name — Part Two")).toBe("placeholder-the-books-name-part-two");
    expect(slugify("Ŝtrange Àccents")).toBe("strange-accents");
    expect(slugify("!!!")).toBe("untitled");
  });
});

describe("import_manuscript", () => {
  const OWNER = "00000000-0000-0000-0000-0000000000f1";
  const GUEST = "00000000-0000-0000-0000-0000000000f2";
  let db: Db;
  const chapters = (n: number) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ title: `Chapter ${i + 1}`, body: `Placeholder text ${i + 1}.`, words: 3 })));
  const run = (who: string, n: number, slug = "placeholder-import") =>
    asUser(db, who, async (tx) => (await tx.query<{ id: string }>(`select import_manuscript($1, 'Placeholder Import', $2::jsonb, 'draft') as id`, [slug, chapters(n)])).rows[0].id);

  beforeAll(async () => {
    db = await freshDb();
    await addUser(db, OWNER, "owner");
    await addUser(db, GUEST, "guest");
  }, 30_000);

  it("is owner-only", async () => {
    expect(await attempt(db, GUEST, `select import_manuscript('x', 'X', '[{"title":"a","body":"b","words":1}]'::jsonb)`)).toMatch(/only the owner/);
    expect(await attempt(db, OWNER, `select import_manuscript('x', 'X', '[]'::jsonb)`)).toMatch(/at least one chapter/);
  });

  it("creates the work with authorship, chapters, texts and word count", async () => {
    const id = await run(OWNER, 3);
    const w = (await db.query<{ author: string; word_count: number; is_placeholder: boolean; visibility: string }>(`select * from works where id = $1`, [id])).rows[0];
    expect(w).toMatchObject({ author: "Itumeleng Ntseng", word_count: 9, is_placeholder: false, visibility: "owner" });
    expect((await db.query(`select * from chapter_texts t join chapters c on c.id = t.chapter_id where c.work_id = $1`, [id])).rows).toHaveLength(3);
  });

  it("never deletes: a shorter re-import archives the extra chapters, a longer one revives them", async () => {
    const id = await run(OWNER, 2);
    const rows = (await db.query<{ position: number; archived: boolean }>(
      `select position, archived_at is not null as archived from chapters where work_id = $1 order by position`, [id])).rows;
    expect(rows).toEqual([{ position: 1, archived: false }, { position: 2, archived: false }, { position: 3, archived: true }]);
    await run(OWNER, 3);
    expect((await db.query(`select * from chapters where work_id = $1 and archived_at is not null`, [id])).rows).toHaveLength(0);
  });

  it("hides archived chapters from readers but not from the owner", async () => {
    const id = await run(OWNER, 1);
    await db.query(`update works set visibility = 'members' where id = $1`, [id]);
    const count = (who: string) => asUser(db, who, async (tx) => (await tx.query(`select * from chapters where work_id = $1`, [id])).rows.length);
    expect(await count(GUEST)).toBe(1);
    expect(await count(OWNER)).toBe(3);
  });

  it("gives the owner readership counts, and guests nothing", async () => {
    const r = await asUser(db, OWNER, async (tx) => (await tx.query(`select * from readership()`)).rows.length);
    expect(r).toBeGreaterThan(0);
    expect(await asUser(db, GUEST, async (tx) => (await tx.query(`select * from readership()`)).rows.length)).toBe(0);
  });
});
