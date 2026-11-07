// Harlem Timeline Map: pure helpers. The street grid is real geography (schematic);
// every place and event comes from content/timeline.ts, which Itu supplies.

/** Avenues west → east, as they run through Harlem north of 110th Street. */
export const AVENUES = [
  { id: "morningside", name: "Morningside Ave" },
  { id: "frederick-douglass", name: "Frederick Douglass Blvd" },
  { id: "adam-clayton-powell", name: "Adam Clayton Powell Jr Blvd" },
  { id: "malcolm-x", name: "Malcolm X Blvd (Lenox Ave)" },
  { id: "fifth", name: "Fifth Ave" },
  { id: "madison", name: "Madison Ave" },
  { id: "park", name: "Park Ave" },
  { id: "lexington", name: "Lexington Ave" },
  { id: "third", name: "Third Ave" },
  { id: "second", name: "Second Ave" },
  { id: "first", name: "First Ave" },
] as const;

export type AvenueId = (typeof AVENUES)[number]["id"];
export const STREET_MIN = 110;
export const STREET_MAX = 155;
export const MAJOR_STREETS = [110, 116, 125, 135, 145, 155];

export interface Place {
  id: string;
  name: string;
  isPlaceholder: boolean;
  street?: number; // cross street, 110–155; omit for places beyond Harlem
  avenue?: AvenueId;
  elsewhere?: string; // e.g. "Free State" — for places off this map
}

export interface TimelineEvent {
  id: string;
  title: string;
  isPlaceholder: boolean;
  date: string; // "1924", "1924-03", "1924-03-15"
  approximate?: boolean;
  placeId?: string;
  appearsIn: string[]; // work slugs
}

export interface Timeline {
  isPlaceholder: boolean;
  places: Place[];
  events: TimelineEvent[];
}

const DATE = /^(\d{4})(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function parseDate(d: string): { key: number; year: number; label: string } | null {
  const m = DATE.exec(d);
  if (!m) return null;
  const [y, mo, da] = [Number(m[1]), m[2] ? Number(m[2]) : 0, m[3] ? Number(m[3]) : 0];
  const label = da ? `${da} ${MONTHS[mo - 1]} ${y}` : mo ? `${MONTHS[mo - 1]} ${y}` : String(y);
  return { key: y * 10_000 + mo * 100 + da, year: y, label };
}

export function dateLabel(e: TimelineEvent): string {
  const p = parseDate(e.date);
  return p ? `${e.approximate ? "c. " : ""}${p.label}` : e.date;
}

export function validateTimeline(t: Timeline, knownWorks: string[] = []): string[] {
  const errors: string[] = [];
  const placeIds = new Set<string>();
  for (const p of t.places) {
    if (placeIds.has(p.id)) errors.push(`Place "${p.id}" appears twice.`);
    placeIds.add(p.id);
    const onMap = p.street !== undefined || p.avenue !== undefined;
    if (onMap && (p.street === undefined || p.avenue === undefined)) errors.push(`${p.name} needs both a street and an avenue.`);
    if (p.street !== undefined && (p.street < STREET_MIN || p.street > STREET_MAX)) errors.push(`${p.name} is off the Harlem map (streets ${STREET_MIN}–${STREET_MAX}); use "elsewhere" instead.`);
    if (!onMap && !p.elsewhere) errors.push(`${p.name} needs a spot on the map or an "elsewhere".`);
  }
  const eventIds = new Set<string>();
  for (const e of t.events) {
    if (eventIds.has(e.id)) errors.push(`Event "${e.id}" appears twice.`);
    eventIds.add(e.id);
    if (!parseDate(e.date)) errors.push(`"${e.title}" has a date the timeline can't read: "${e.date}" (use 1924, 1924-03 or 1924-03-15).`);
    if (e.placeId && !placeIds.has(e.placeId)) errors.push(`"${e.title}" happens at "${e.placeId}", which isn't a listed place.`);
    for (const w of e.appearsIn) if (knownWorks.length && !knownWorks.includes(w)) errors.push(`"${e.title}" appears in "${w}", which isn't in the catalogue.`);
  }
  return errors;
}

export function sortEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => (parseDate(a.date)?.key ?? 0) - (parseDate(b.date)?.key ?? 0) || a.title.localeCompare(b.title));
}

export function yearSpan(events: TimelineEvent[]): [number, number] | null {
  const ys = events.map((e) => parseDate(e.date)?.year).filter((y): y is number => y !== undefined);
  return ys.length ? [Math.min(...ys), Math.max(...ys)] : null;
}

export function eventsBetween(events: TimelineEvent[], from: number, to: number): TimelineEvent[] {
  return sortEvents(events.filter((e) => { const y = parseDate(e.date)?.year; return y !== undefined && y >= from && y <= to; }));
}

// ── The map ───────────────────────────────────────────────────────────────

export const MAP = { width: 560, height: 640, pad: 36 };

/** Grid position → SVG point. North is up; the east side is on the right. */
export function project(street: number, avenue: AvenueId): { x: number; y: number } {
  const i = AVENUES.findIndex((a) => a.id === avenue);
  const x = MAP.pad + (i / (AVENUES.length - 1)) * (MAP.width - 2 * MAP.pad);
  const y = MAP.height - MAP.pad - ((street - STREET_MIN) / (STREET_MAX - STREET_MIN)) * (MAP.height - 2 * MAP.pad);
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

/** Restrict a timeline to the works in view (canon switch). Places stay; events filter. */
export function timelineForWorks(t: Timeline, slugs: Set<string>): Timeline {
  return { ...t, events: t.events.filter((e) => e.appearsIn.length === 0 || e.appearsIn.some((w) => slugs.has(w))) };
}

/** C59: "Find an event" — every typed word starts a word of the event's title or its place's name. */
export function findEvents(events: TimelineEvent[], places: Place[], query: string): TimelineEvent[] {
  const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const words = fold(query).split(" ").filter(Boolean);
  if (words.length === 0) return events;
  const placeName = new Map(places.map((p) => [p.id, p.name]));
  return events.filter((e) => {
    const hay = ` ${fold(`${e.title} ${e.placeId ? placeName.get(e.placeId) ?? "" : ""}`)} `;
    return words.every((w) => hay.includes(` ${w}`));
  });
}
