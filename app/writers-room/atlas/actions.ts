"use server";

import { revalidatePath } from "next/cache";
import { ATLAS_KINDS, type AtlasKind } from "@/lib/atlas";
import { saveAtlas } from "@/lib/atlasStore";

export interface AtlasState { ok: boolean; message: string; errors?: string[] }

export async function saveAtlasAction(_: AtlasState, form: FormData): Promise<AtlasState> {
  const kind = String(form.get("kind") ?? "") as AtlasKind;
  if (!ATLAS_KINDS.includes(kind)) return { ok: false, message: "Unknown document." };
  const r = await saveAtlas(kind, String(form.get("body") ?? ""));
  if (r.ok) {
    revalidatePath(kind === "lineage" ? "/lineage" : "/timeline");
    revalidatePath("/writers-room/atlas");
  }
  return r;
}
