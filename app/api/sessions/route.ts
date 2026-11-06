import { NextResponse, type NextRequest } from "next/server";
import { parseSessionPayload } from "@/lib/sessions";
import { recordSession } from "@/lib/sessionStore";

// The reading room reports sessions here (heartbeats + on leaving the page).
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  // Same-site only: the browser always sends Origin on a cross-site POST.
  if (origin) {
    let host = "";
    try { host = new URL(origin).host; } catch { /* malformed */ }
    if (host !== req.headers.get("host")) return new NextResponse(null, { status: 403 });
  }
  const text = await req.text();
  if (text.length > 64_000) return new NextResponse(null, { status: 413 });
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return new NextResponse(null, { status: 400 }); }
  const payload = parseSessionPayload(raw, Date.now());
  if (!payload) return new NextResponse(null, { status: 400 });
  return new NextResponse(null, { status: (await recordSession(payload)) ? 204 : 403 });
}
