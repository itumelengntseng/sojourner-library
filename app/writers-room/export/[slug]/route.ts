import { NextResponse, type NextRequest } from "next/server";
import { getWork } from "@/lib/catalogue";
import { ownerClient } from "@/lib/writersRoom";
import { withAuthor } from "@/lib/catalogueRows";
import { exportFilename, manuscriptMarkdown, type ExportChapter } from "@/lib/manuscriptExport";

// Owner-only: download a work (set-aside works included) as Markdown. Read-only.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const part = req.nextUrl.searchParams.get("part") === "set-aside" ? "set-aside" : "shelved";
  const { supabase, reason } = await ownerClient();
  let work: { title: string; author: string; chapters: ExportChapter[] } | null = null;

  if (reason === "preview") {
    const w = getWork(slug);
    if (w) work = { title: w.title, author: w.author, chapters: w.chapters.map((c) => ({ position: c.position, title: c.title, body: c.body, archived: false })) };
  } else if (supabase) {
    const { data: w } = await supabase.from("works").select("id, title, author").eq("slug", slug).maybeSingle();
    if (w) {
      const { data: rows } = await supabase.from("chapters").select("id, position, title, archived_at").eq("work_id", w.id).order("position");
      const list = (rows ?? []) as { id: string; position: number; title: string; archived_at: string | null }[];
      const bodies = new Map<string, string>();
      for (let i = 0; i < list.length; i += 100) {
        const { data: texts } = await supabase.from("chapter_texts").select("chapter_id, body_md").in("chapter_id", list.slice(i, i + 100).map((c) => c.id));
        for (const t of (texts ?? []) as { chapter_id: string; body_md: string }[]) bodies.set(t.chapter_id, t.body_md);
      }
      work = {
        title: w.title as string, author: withAuthor(w.author as string),
        chapters: list.map((c) => ({ position: c.position, title: c.title, body: bodies.get(c.id) ?? "", archived: c.archived_at !== null })),
      };
    }
  } else {
    return new NextResponse("Only the Keeper can download manuscripts.", { status: reason === "signed-out" ? 401 : 403 });
  }

  if (!work) return new NextResponse("No such work on the shelves.", { status: 404 });
  const now = new Date();
  return new NextResponse(manuscriptMarkdown({ ...work, slug }, part, now), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(slug, part, now)}"`,
      "cache-control": "private, no-store",
    },
  });
}
