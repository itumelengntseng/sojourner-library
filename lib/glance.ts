// The Writer's Room "library at a glance" — pure, so it can be tested without a server.
export interface GlanceTile { label: string; value: string; note?: string;
  /** C128: the part of the note that needs the Keeper's eye (shown in ember after the note). */
  urgentNote?: string;
  /** C215: where the note leads (an in-page anchor), when it has somewhere to go. */
  href?: string }

/** "The library at a glance": counts only — never who read what. */
export function glance(works: { visibility: "owner" | "members"; words: number; openLoans: number; finished?: number; isPlaceholder?: boolean }[], setAside: number, cardHolders: number | null, dueSoon = 0, returnedHour = 0, borrowedHour = 0, loansMonth: MonthLoans | null = null): GlanceTile[] {
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
  // C165: and how many of those came back before they were due (counts only).
  if (loansMonth !== null) tiles.push({ label: "Loans this month", value: loansMonth.taken.toLocaleString("en-ZA"),
    note: loansMonth.taken ? `taken out in the last 30 days${loansMonth.early > 0 ? ` · ${Math.min(loansMonth.early, loansMonth.taken).toLocaleString("en-ZA")} handed back before ${loansMonth.early === 1 ? "it was" : "they were"} due` : ""}` : "none taken out in the last 30 days" });
  // C45: shown once the library can count it (finished_readers() answered for every work).
  if (works.length > 0 && works.every((w) => w.finished !== undefined)) {
    const done = works.reduce((a, w) => a + (w.finished ?? 0), 0);
    tiles.push({ label: "Read to the end", value: String(done), note: done ? "by guest readers, counted per book" : "no guest has reached an ending yet" });
  }
  // C215: how many works still carry placeholder text — waiting for Itu's own manuscripts (owner's room only).
  if (works.length > 0 && works.every((w) => w.isPlaceholder !== undefined)) {
    const waiting = works.filter((w) => w.isPlaceholder).length;
    tiles.push({ label: "Still placeholder", value: String(waiting), note: waiting ? `${waiting === 1 ? "work waits" : "works wait"} for your manuscript${waiting === 1 ? "" : "s"}` : "every work is in your own words", ...(waiting ? { href: "#shelves" } : {}) });
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

export interface MonthLoans { taken: number; early: number }
/** C165: the month's loans and how many of them were handed back before they were due (the ledger's C152 rule). */
export function monthLoans(loans: { borrowedAt: number; returnedAt: number | null; dueAt: number }[], now: number): MonthLoans {
  const recent = loans.filter((l) => l.borrowedAt <= now && now - l.borrowedAt < 30 * DAY);
  return { taken: recent.length, early: recent.filter((l) => l.returnedAt !== null && l.returnedAt < l.dueAt).length };
}
