// The Writer's Room "library at a glance" — pure, so it can be tested without a server.
export interface GlanceTile { label: string; value: string; note?: string }

/** "The library at a glance": counts only — never who read what. */
export function glance(works: { visibility: "owner" | "members"; words: number; openLoans: number; finished?: number }[], setAside: number, cardHolders: number | null): GlanceTile[] {
  const shared = works.filter((w) => w.visibility === "members").length;
  const words = works.reduce((a, w) => a + w.words, 0);
  const loans = works.reduce((a, w) => a + w.openLoans, 0);
  const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-ZA")} ${n === 1 ? one : many}`;
  const tiles: GlanceTile[] = [
    { label: "On the shelves", value: String(works.length), note: `${shared} shared · ${works.length - shared} only me${setAside ? ` · ${setAside} set aside` : ""}` },
    { label: "Words shelved", value: words.toLocaleString("en-ZA") },
    { label: "Card holders", value: cardHolders === null ? "—" : String(cardHolders), note: cardHolders === null ? "once the library is connected" : undefined },
    { label: "Out on loan now", value: String(loans), note: loans ? plural(loans, "open loan") : "every book is in" },
  ];
  // C45: shown once the library can count it (finished_readers() answered for every work).
  if (works.length > 0 && works.every((w) => w.finished !== undefined)) {
    const done = works.reduce((a, w) => a + (w.finished ?? 0), 0);
    tiles.push({ label: "Read to the end", value: String(done), note: done ? "by guest readers, counted per book" : "no guest has reached an ending yet" });
  }
  return tiles;
}

const DAY = 86_400_000;

/** C39: "changed today" / "changed yesterday" / "changed 3 days ago" / "changed 6 Oct 2026" (SA time). */
export function changedLabel(iso: string | undefined, now: number): string | null {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return null;
  const sast = (ms: number) => Math.floor((ms + 2 * 3600_000) / DAY);
  const days = sast(now) - sast(t);
  if (days <= 0) return "changed today";
  if (days === 1) return "changed yesterday";
  if (days < 7) return `changed ${days} days ago`;
  return `changed ${new Date(t).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Johannesburg" })}`;
}
