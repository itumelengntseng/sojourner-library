// "Last backed up" beside the Writer's Room backup button (C35). Kept per browser — no new table.
import { DESK_TIME_ZONE } from "./loanDesk";

export const BACKUP_KEY = "soj:last-backup";
export const BACKUP_REMIND_DAYS = 30;
const DAY = 86_400_000;

/** A stored timestamp, or null if missing, unreadable or in the future. */
export function parseLastBackup(raw: string | null | undefined, now: number): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= now + 60_000 ? Math.floor(n) : null;
}

export interface BackupNote { text: string; remind: string | null }

export function backupNote(last: number | null, now: number): BackupNote {
  if (last === null) {
    return { text: "Not backed up from this browser yet.", remind: "Download a copy to keep somewhere safe." };
  }
  const when = new Date(last).toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: DESK_TIME_ZONE });
  const days = Math.floor((now - last) / DAY);
  return {
    text: `Last backed up ${when} (from this browser).`,
    remind: days >= BACKUP_REMIND_DAYS ? `That was ${days} days ago — a fresh copy would be wise.` : null,
  };
}
