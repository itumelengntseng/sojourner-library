// The Writer's Room "library at a glance" — pure, so it can be tested without a server.
export interface GlanceTile { label: string; value: string; note?: string;
  /** C128: the part of the note that needs the Keeper's eye (shown in ember after the note). */
  urgentNote?: string }

/** "The library at a glance": counts only — never who read what. */
export function glance(works: { visibility: "owner" | "members"; words: number; openLoans: number; finished?: number }[], setAside: number, cardHolders: number | null, dueSoon = 0, returnedHour = 0, borrowedHour = 0, loansMonth: number | null = null): GlanceTile[] {
  const shared = works.filter((w) => w.visibility === "members").length;
  const words = works.reduce((a, w) => a + w.words, 0);
  const loans = works.reduce((a, w) => a + w.openLoans, 0);
  const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-ZA")} ${n === 1 ? one : many}`;
  const tiles: GlanceTile[] = [
    { label: "On the shelves", value: String(works.length), note: `${shared} shared · ${works.length - shared} only me${setAside ? ` · ${setAside} set aside` : ""}` },
    { label: "Words shelved", value: words.toLocaleString("en-ZA") },
    { label: "Card holders", value: cardHolders === null ? "—" : String(cardHolders), note: cardHolders === null ? "once the library is connected" : undefined },
    // C122: how many of those are due back within the day — a count only, never who.
    // C136/C139: and how many went out / came back in the last hour (counts only).
    { label: "Out on loan now", value: String(loans), note: `${loans ? plural(loans, "open loan") : "every book is in"}${borrowedHour > 0 ? ` · ${borrowedHour.toLocaleString("en-ZA")} borrowed in the last hour` : ""}${returnedHour > 0 ? ` · ${returnedHour.toLocaleString("en-ZA")} returned in the last hour` : ""}`,
      ...(loans && dueSoon > 0 ? { urgentNote: `${Math.min(dueSoon, loans).toLocaleString("en-ZA")} due back within the day` } : {}) },
  ];
  // C163: loans taken out in the last 30 days — a head count only, never who or what.
  if (loansMonth !== null) tiles.push({ label: "Loans this month", value: loansMonth.toLocaleString("en-ZA"), note: loansMonth ? "taken out in the last 30 days" : "none taken out in the last 30 days" });
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

/** C163: how many loans were taken out in the 30 days before `now` (borrow times only). */
export function loansInMonth(borrowedAt: number[], now: number): number {
  return borrowedAt.filter((t) => t <= now && now - t < 30 * DAY).length;
}
