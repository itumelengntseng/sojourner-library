import { NextResponse, type NextRequest } from "next/server";
import { exportNotes } from "@/lib/ledgerStore";
import { notesFilename } from "@/lib/ledger";

// Library mode: download your notes and highlights as Markdown.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("work")?.slice(0, 200) || undefined;
  const md = await exportNotes(slug);
  if (md === null) return new NextResponse("Sign in at the front desk to export your notes.", { status: 401 });
  return new NextResponse(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${notesFilename(slug)}"`,
      "cache-control": "private, no-store",
    },
  });
}
