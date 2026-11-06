import { NextResponse } from "next/server";
import { onePager } from "@/lib/pitch";
import { ownerPitchLinks, pitchFor } from "@/lib/pitchStore";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { allowed } = await ownerPitchLinks();
  const p = pitchFor(slug);
  if (!allowed || !p) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(onePager(p.kit, p.work), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}-one-pager.md"`,
      "cache-control": "private, no-store",
    },
  });
}
