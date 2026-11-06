import { beforeAll, describe, expect, it } from "vitest";
import { getWorks, hallsFor, HALLS } from "@/lib/catalogue";
import { NO_BLURB, withAuthor, worksFromRows, type ChapterRow, type WorkRow } from "@/lib/catalogueRows";
import { workStats } from "@/lib/workStats";
import { addUser, asUser, freshDb, type Db } from "./helpers/db";

const row = (o: Partial<WorkRow> & { id: string; slug: string }): WorkRow => ({
  title: o.slug, author: "Itumeleng Ntseng", hall: "main", series: null, series_order: null,
  canon_status: "canon", is_placeholder: true, archived_at: null, ...o,
});

describe("catalogue from rows", () => {
  it("maps works and chapters in order, using stored word counts", () => {
    const works = worksFromRows(
      [row({ id: "a", slug: "placeholder-a", title: "Placeholder A" })],
      [
        { work_id: "a", position: 2, title: "Two", word_count: 230 },
        { work_id: "a", position: 1, title: "One", word_count: 460 },
      ],
    );
    expect(works).toHaveLength(1);
    expect(works[0].chapters.map((c) => [c.position, c.title, c.words, c.body])).toEqual([[1, "One", 460, ""], [2, "Two", 230, ""]]);
    const s = workStats(works[0]);
    expect(s.words).toBe(690);
    expect(s.readingTime).toBe("3 min");
  });
  it("leaves out archived works and archived chapters", () => {
    const works = worksFromRows(
      [row({ id: "a", slug: "a" }), row({ id: "b", slug: "b", archived_at: "2026-01-01" })],
      [
        { work_id: "a", position: 1, title: "One", word_count: 5 },
        { work_id: "a", position: 2, title: "Old", word_count: 5, archived_at: "2026-01-01" },
        { work_id: "b", position: 1, title: "B", word_count: 5 },
      ] as ChapterRow[],
    );
    expect(works.map((w) => w.slug)).toEqual(["a"]);
    expect(works[0].chapters.map((c) => c.title)).toEqual(["One"]);
  });
  it("always shows Itumeleng Ntseng as the author", () => {
    expect(withAuthor(null)).toBe("Itumeleng Ntseng");
    expect(withAuthor("Someone Else")).toBe("Itumeleng Ntseng");
    expect(withAuthor("Itumeleng Ntseng (ed.)")).toBe("Itumeleng Ntseng (ed.)");
    expect(worksFromRows([row({ id: "a", slug: "a", author: "" })], [])[0].author).toBe("Itumeleng Ntseng");
  });
  it("treats an unknown canon status as not canon, and a blank hall as the main hall", () => {
    const [w] = worksFromRows([row({ id: "a", slug: "a", canon_status: "weird", hall: " " })], []);
    expect(w.canonStatus).toBe("draft");
    expect(w.hall).toBe("main");
  });
  it("never invents a description for real works", () => {
    const [real, ph] = worksFromRows([row({ id: "a", slug: "a", title: "A", is_placeholder: false }), row({ id: "b", slug: "b", title: "B" })], []);
    expect(real.blurb).toBe(NO_BLURB);
    expect(ph.blurb).toMatch(/^Placeholder/);
  });
  it("shows the author's own description when there is one", () => {
    const [w] = worksFromRows([row({ id: "a", slug: "a", is_placeholder: false, description: "  Placeholder description typed in the Writer's Room.  " })], []);
    expect(w.blurb).toBe("Placeholder description typed in the Writer's Room.");
    expect(worksFromRows([row({ id: "b", slug: "b", is_placeholder: false, description: "   " })], [])[0].blurb).toBe(NO_BLURB);
  });
  it("orders by series, then series order, then title", () => {
    const works = worksFromRows([
      row({ id: "1", slug: "z", title: "Z" }),
      row({ id: "2", slug: "s2", title: "A", series: "S", series_order: 2 }),
      row({ id: "3", slug: "s1", title: "B", series: "S", series_order: 1 }),
      row({ id: "4", slug: "y", title: "Y" }),
    ], []);
    expect(works.map((w) => w.slug)).toEqual(["y", "z", "s1", "s2"]);
  });
});

describe("halls", () => {
  it("adds halls named by shelved works so nothing goes missing", () => {
    const halls = hallsFor([{ hall: "main" }, { hall: "east-wing" }, { hall: "east-wing" }]);
    expect(halls.map((h) => h.id)).toEqual([...HALLS.map((h) => h.id), "east-wing"]);
    expect(halls.at(-1)!.name).toBe("East Wing");
  });
  it("keeps just the named halls for the placeholder catalogue", () => {
    expect(hallsFor(getWorks())).toEqual([...HALLS]);
  });
});

describe("catalogue queries against the schema (RLS)", () => {
  const OWNER = "00000000-0000-0000-0000-0000000000c1";
  const GUEST = "00000000-0000-0000-0000-0000000000c2";
  let db: Db;
  const chapters = (n: number) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ title: `Chapter ${i + 1}`, body: `Placeholder text ${i + 1}.`, words: 3 })));
  // The same two queries lib/catalogueServer.ts makes.
  const shelf = (who: string | null) => asUser(db, who, async (tx) => {
    const works = (await tx.query<WorkRow>(`select id, slug, title, author, hall, series, series_order, canon_status, is_placeholder, description, archived_at from works where archived_at is null`)).rows;
    const ids = works.map((w) => w.id);
    const chs = ids.length ? (await tx.query<ChapterRow>(`select work_id, position, title, word_count, archived_at from chapters where work_id = any($1::uuid[]) and archived_at is null`, [ids])).rows : [];
    return worksFromRows(works, chs);
  });

  beforeAll(async () => {
    db = await freshDb();
    await addUser(db, OWNER, "owner");
    await addUser(db, GUEST, "guest");
    await asUser(db, OWNER, (tx) => tx.query(`select import_manuscript('placeholder-shelved', 'Placeholder Shelved', $1::jsonb, 'draft')`, [chapters(3)]));
    await asUser(db, OWNER, (tx) => tx.query(`select import_manuscript('placeholder-shelved', 'Placeholder Shelved', $1::jsonb, 'draft')`, [chapters(2)]));
  }, 30_000);

  it("shows a Writer's Room import on the owner's shelf, without archived chapters", async () => {
    const works = await shelf(OWNER);
    expect(works.map((w) => w.slug)).toEqual(["placeholder-shelved"]);
    expect(works[0].chapters.map((c) => c.title)).toEqual(["Chapter 1", "Chapter 2"]);
    expect(workStats(works[0]).words).toBe(6);
    expect(works[0].author).toBe("Itumeleng Ntseng");
  });
  it("hides it from guests until it is shared, and from anyone without a card", async () => {
    expect(await shelf(GUEST)).toEqual([]);
    await expect(shelf(null)).rejects.toThrow(/permission denied/);
    await db.query(`update works set visibility = 'members' where slug = 'placeholder-shelved'`);
    const works = await shelf(GUEST);
    expect(works.map((w) => [w.slug, w.chapters.length])).toEqual([["placeholder-shelved", 2]]);
    await expect(shelf(null)).rejects.toThrow(/permission denied/);
  });
});

describe("work descriptions (schema)", () => {
  const OWNER = "00000000-0000-0000-0000-0000000000c5";
  const GUEST = "00000000-0000-0000-0000-0000000000c6";
  let db: Db;
  beforeAll(async () => {
    db = await freshDb();
    await addUser(db, OWNER, "owner");
    await addUser(db, GUEST, "guest");
    await db.query(`insert into works (slug, title, visibility) values ('placeholder-desc', 'P', 'members')`);
  }, 30_000);
  it("starts empty; the owner writes it; guests read it but can't change it", async () => {
    expect((await db.query<{ description: string }>(`select description from works`)).rows[0].description).toBe("");
    await asUser(db, OWNER, (tx) => tx.query(`update works set description = 'Placeholder description.' where slug = 'placeholder-desc'`));
    const seen = await asUser(db, GUEST, async (tx) => (await tx.query<{ description: string }>(`select description from works`)).rows);
    expect(seen).toEqual([{ description: "Placeholder description." }]);
    const changed = await asUser(db, GUEST, async (tx) => (await tx.query(`update works set description = 'x' returning id`)).rows.length);
    expect(changed).toBe(0);
  });
  it("caps the length", async () => {
    await expect(db.query(`update works set description = repeat('x', 2001)`)).rejects.toThrow(/check/);
  });
});
