// C102: the reading room's quiet "due back within the hour" line.
// Pure helpers so the rule and the clock format are unit-tested.

const HOUR = 3600_000;

/** "14:00" — the due time on the SA clock (the desk's time zone). */
export function dueClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Johannesburg" });
}

/** True when an open loan is due back within the hour (and not yet past due). */
export function dueWithinHour(dueAt: number, now: number): boolean {
  return dueAt > now && dueAt - now <= HOUR;
}
