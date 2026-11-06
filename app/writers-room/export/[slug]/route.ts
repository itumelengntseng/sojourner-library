import { NextResponse, type NextRequest } from "next/server";
import { ownerClient } from "@/lib/writersRoom";
import { loadExportWork } from "@/lib/backupServer";
import { exportFilename, manuscriptMarkdown } from "@/lib/manuscriptExport";

// Owner-only: download a work (set-aside works included) as Markdown. Read-only.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const part = req.nextUrl.searchParams.get("part") === "set-aside" ? "set-aside" : "shelved";
  const owner = await ownerClient();
  if (owner.reason !== "preview" && !owner.supabase) {
    return new NextResponse("Only the Keeper can download manuscripts.", { status: owner.reason === "signed-out" ? 401 : 403 });
  }
  const work = await loadExportWork(owner, slug);
  if (!work) return new NextResponse("No such work on the shelves.", { status: 404 });
  const now = new Date();
  return new NextResponse(manuscriptMarkdown(work, part, now), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(slug, part, now)}"`,
      "cache-control": "private, no-store",
    },
  });
}
