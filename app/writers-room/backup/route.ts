import { NextResponse } from "next/server";
import { ownerClient } from "@/lib/writersRoom";
import { backupEntries } from "@/lib/backupServer";
import { zipStored } from "@/lib/zip";

// C31: owner-only "Back up everything" — one .zip of every manuscript, the library's settings and the atlas. Read-only.
export async function GET() {
  const owner = await ownerClient();
  if (owner.reason !== "preview" && !owner.supabase) {
    return new NextResponse("Only the Keeper can download the backup.", { status: owner.reason === "signed-out" ? 401 : 403 });
  }
  const now = new Date();
  const entries = await backupEntries(owner, now);
  if (!entries) return new NextResponse("Only the Keeper can download the backup.", { status: 403 });
  const zip = zipStored(entries, now);
  return new NextResponse(zip as unknown as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="sojourner-library-backup-${now.toISOString().slice(0, 10)}.zip"`,
      "cache-control": "private, no-store",
    },
  });
}
