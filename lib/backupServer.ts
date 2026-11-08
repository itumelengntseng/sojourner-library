import "server-only";
// C27/C31: the Keeper's backups — read-only loaders shared by the export routes.
import { getWork, getWorks, HALLS } from "./catalogue";
import { withAuthor } from "./catalogueRows";
import { LINEAGE } from "@/content/lineage";
import { TIMELINE } from "@/content/timeline";
import { getPitch, PITCHES } from "@/content/pitches";
import { atlasFlags, waitingForWords, waitingReadme } from "./waiting";
import { manuscriptMarkdown, type ExportChapter, type ExportWork } from "./manuscriptExport";
import { ownerClient } from "./writersRoom";
import type { ZipEntry } from "./zip";

type Owner = Awaited<ReturnType<typeof ownerClient>>;
type Sb = NonNullable<Owner["supabase"]>;

async function chaptersFor(supabase: Sb, workId: string): Promise<ExportChapter[]> {
  const { data: rows } = await supabase.from("chapters").select("id, position, title, archived_at").eq("work_id", workId).order("position").limit(1000);
  const list = (rows ?? []) as { id: string; position: number; title: string; archived_at: string | null }[];
  const bodies = new Map<string, string>();
  for (let i = 0; i < list.length; i += 100) {
    const { data: texts } = await supabase.from("chapter_texts").select("chapter_id, body_md").in("chapter_id", list.slice(i, i + 100).map((c) => c.id));
    for (const t of (texts ?? []) as { chapter_id: string; body_md: string }[]) bodies.set(t.chapter_id, t.body_md);
  }
  return list.map((c) => ({ position: c.position, title: c.title, body: bodies.get(c.id) ?? "", archived: c.archived_at !== null }));
}

function previewWork(slug: string): ExportWork | null {
  const w = getWork(slug);
  return w ? { title: w.title, slug: w.slug, author: w.author, chapters: w.chapters.map((c) => ({ position: c.position, title: c.title, body: c.body, archived: false })) } : null;
}

/** One work (set-aside works included), or null. Call only with an owner client or in preview. */
export async function loadExportWork(owner: Owner, slug: string): Promise<ExportWork | null> {
  if (owner.reason === "preview") return previewWork(slug);
  if (!owner.supabase) return null;
  const { data: w } = await owner.supabase.from("works").select("id, title, author").eq("slug", slug).maybeSingle();
  if (!w) return null;
  return { title: w.title as string, slug, author: withAuthor(w.author as string), chapters: await chaptersFor(owner.supabase, w.id as string) };
}

const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

/** Everything the Keeper has written into the library, as files for one zip (C31). */
export async function backupEntries(owner: Owner, now: Date): Promise<ZipEntry[] | null> {
  const entries: ZipEntry[] = [];
  const add = (w: ExportWork) => {
    entries.push({ name: `manuscripts/${w.slug}.md`, data: manuscriptMarkdown(w, "shelved", now) });
    if (w.chapters.some((c) => c.archived)) entries.push({ name: `manuscripts/${w.slug}-set-aside.md`, data: manuscriptMarkdown(w, "set-aside", now) });
  };
  let note: string;
  let waiting: ReturnType<typeof waitingForWords>;
  if (owner.reason === "preview") {
    for (const w of getWorks()) add(previewWork(w.slug)!);
    entries.push({ name: "library/works.json", data: json(getWorks().map((w) => ({ slug: w.slug, title: w.title, author: w.author, canonStatus: w.canonStatus, hall: w.hall }))) });
    entries.push({ name: "library/halls.json", data: json(HALLS) });
    entries.push({ name: "library/pitch-kits.json", data: json(PITCHES) });
    entries.push({ name: "atlas/lineage.json", data: json(LINEAGE) }, { name: "atlas/timeline.json", data: json(TIMELINE) });
    note = "Preview copy: placeholder works and files only (the library is not connected).";
    // C229: what is still placeholder, as the Writer's Room panel counts it.
    waiting = waitingForWords({ works: getWorks().map(() => ({ isPlaceholder: true })), kits: PITCHES, people: LINEAGE.people, places: TIMELINE.places, events: TIMELINE.events, hallsNamed: false });
  } else if (owner.supabase) {
    const sb = owner.supabase;
    const [{ data: works }, { data: halls }, { data: kits }, { data: atlas }] = await Promise.all([
      sb.from("works").select("*").order("title").limit(1000),
      sb.from("halls").select("*"),
      sb.from("pitch_kits").select("*"),
      sb.from("atlas_documents").select("kind, body, updated_at"),
    ]);
    for (const w of (works ?? []) as { id: string; slug: string; title: string; author: string }[]) {
      add({ title: w.title, slug: w.slug, author: withAuthor(w.author), chapters: await chaptersFor(sb, w.id) });
    }
    entries.push({ name: "library/works.json", data: json(works ?? []) });
    entries.push({ name: "library/halls.json", data: json(halls ?? []) });
    entries.push({ name: "library/pitch-kits.json", data: json(kits ?? []) });
    const stored = new Map(((atlas ?? []) as { kind: string; body: unknown }[]).map((r) => [r.kind, r.body]));
    // The stored copy exactly as saved (even if it no longer checks out); the file when nothing is stored.
    entries.push({ name: "atlas/lineage.json", data: json(stored.get("lineage") ?? LINEAGE) }, { name: "atlas/timeline.json", data: json(stored.get("timeline") ?? TIMELINE) });
    // C229: shelved works and their kits as shown (stored → file → empty, which is a placeholder); the atlas copy in use.
    const shelved = ((works ?? []) as { slug: string; is_placeholder?: boolean; archived_at?: string | null }[]).filter((w) => !w.archived_at);
    const kitFlag = new Map(((kits ?? []) as { work_slug: string; is_placeholder?: boolean }[]).map((k) => [k.work_slug, k.is_placeholder !== false]));
    const lin = stored.get("lineage") ?? LINEAGE, tl = stored.get("timeline") ?? TIMELINE;
    waiting = waitingForWords({
      works: shelved.map((w) => ({ isPlaceholder: w.is_placeholder !== false })),
      kits: shelved.map((w) => ({ isPlaceholder: kitFlag.get(w.slug) ?? getPitch(w.slug)?.isPlaceholder ?? true })),
      people: atlasFlags(lin, "people"), places: atlasFlags(tl, "places"), events: atlasFlags(tl, "events"),
      hallsNamed: ((halls ?? []) as unknown[]).length > 0,
    });
    note = "Everything the Keeper has written into the library. Readers' notes, highlights, loans and sessions are not included — they belong to the readers.";
  } else {
    return null;
  }
  entries.unshift({
    name: "README.txt",
    data: [
      "The Sojourner Library — backup",
      `All works by Itumeleng Ntseng. Exported ${now.toISOString()}.`,
      "",
      note,
      "manuscripts/*.md re-import unchanged in the Writer's Room (Shelve a manuscript); *-set-aside.md hold chapters set aside.",
      "atlas/*.json paste into Writer's Room → The family wall & timeline → Whole file (JSON).",
      "",
      ...waitingReadme(waiting),
      "",
    ].join("\n"),
  });
  return entries;
}
