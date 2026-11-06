import { NextResponse } from "next/server";
import { exportNotes } from "@/lib/ledgerStore";

// Library mode: download your notes and highlights as Markdown.
export async function GET() {
  const md = await exportNotes();
  if (md === null) return new NextResponse("Sign in at the front desk to export your notes.", { status: 401 });
  return new NextResponse(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": 'attachment; filename="sojourner-notes.md"',
      "cache-control": "private, no-store",
    },
  });
}
