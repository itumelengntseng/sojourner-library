import "server-only";
// C232: what still waits for the Keeper's words, for the front hall — the Keeper only (owner in library
// mode; preview, where the Writer's Room is open too). Guests and signed-out visitors get null.
import { loadAtlas } from "./atlasStore";
import { loadCatalogue } from "./catalogueServer";
import { roomPitches } from "./pitchStore";
import { ownerClient } from "./writersRoom";
import { waitingForWords } from "./waiting";

export async function keeperWaiting(): Promise<ReturnType<typeof waitingForWords> | null> {
  const { supabase, reason } = await ownerClient();
  if (reason !== "preview" && !supabase) return null;
  const [atlas, catalogue, { pitches }, hallsNamed] = await Promise.all([
    loadAtlas(),
    loadCatalogue(),
    roomPitches(),
    supabase ? supabase.from("halls").select("id", { count: "exact", head: true }).then((r) => (r.count ?? 0) > 0) : Promise.resolve(false),
  ]);
  return waitingForWords({
    // The Keeper's shelves as the catalogue reads them (set-aside works left out), each with its own mark.
    works: catalogue.works.map((w) => ({ isPlaceholder: w.isPlaceholder })),
    kits: pitches.map((p) => p.kit),
    people: atlas.lineage.people, places: atlas.timeline.places, events: atlas.timeline.events,
    hallsNamed,
  });
}
