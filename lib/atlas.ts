// The family wall and the Harlem timeline, editable in the Writer's Room. The Keeper
// edits each as a JSON document (same shape as content/lineage.ts / content/timeline.ts);
// it is shape-checked here and then run through the same validators as the files.
import { validateLineage, type Lineage, type Person } from "./lineage";
import { AVENUES, validateTimeline, type AvenueId, type Place, type Timeline, type TimelineEvent } from "./timeline";

export type AtlasKind = "lineage" | "timeline";
export const ATLAS_KINDS: AtlasKind[] = ["lineage", "timeline"];
export const ATLAS_MAX_CHARS = 400_000;

export type Checked<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strList = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");

function people(raw: unknown, errors: string[]): Person[] {
  if (!Array.isArray(raw)) { errors.push(`"people" must be a list.`); return []; }
  return raw.flatMap((p, i) => {
    const at = `Person ${i + 1}`;
    if (!isObj(p)) { errors.push(`${at} isn't an entry with fields.`); return []; }
    const bad: string[] = [];
    if (typeof p.id !== "string") bad.push("an id");
    if (typeof p.name !== "string" || !p.name.trim()) bad.push("a name");
    for (const k of ["parents", "partners", "appearsIn"]) if (p[k] !== undefined && !strList(p[k])) bad.push(`"${k}" as a list of ids`);
    if (p.note !== undefined && typeof p.note !== "string") bad.push(`"note" as text`);
    if (bad.length) { errors.push(`${typeof p.name === "string" && p.name ? p.name : at} needs ${bad.join(", ")}.`); return []; }
    return [{
      id: p.id as string, name: (p.name as string).trim(), isPlaceholder: p.isPlaceholder !== false,
      ...(typeof p.note === "string" && p.note ? { note: p.note } : {}),
      parents: (p.parents as string[] | undefined) ?? [], partners: (p.partners as string[] | undefined) ?? [], appearsIn: (p.appearsIn as string[] | undefined) ?? [],
    }];
  });
}

export function coerceLineage(raw: unknown): Checked<Lineage> {
  const errors: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ["The lineage should be one { … } entry with a title and people."] };
  const list = people(raw.people, errors);
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "The family wall", isPlaceholder: raw.isPlaceholder !== false, people: list } };
}

const AVENUE_IDS = new Set<string>(AVENUES.map((a) => a.id));

export function coerceTimeline(raw: unknown): Checked<Timeline> {
  const errors: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ["The timeline should be one { … } entry with places and events."] };
  if (!Array.isArray(raw.places)) errors.push(`"places" must be a list.`);
  if (!Array.isArray(raw.events)) errors.push(`"events" must be a list.`);
  if (errors.length) return { ok: false, errors };
  const places: Place[] = (raw.places as unknown[]).flatMap((p, i) => {
    const at = isObj(p) && typeof p.name === "string" && p.name ? p.name : `Place ${i + 1}`;
    if (!isObj(p) || typeof p.id !== "string" || typeof p.name !== "string" || !p.name.trim()) { errors.push(`${at} needs an id and a name.`); return []; }
    if (p.street !== undefined && !Number.isInteger(p.street)) { errors.push(`${at}: the street should be a whole number, like 125.`); return []; }
    if (p.avenue !== undefined && !AVENUE_IDS.has(String(p.avenue))) { errors.push(`${at}: "${String(p.avenue)}" isn't one of the avenues (${[...AVENUE_IDS].join(", ")}).`); return []; }
    if (p.elsewhere !== undefined && typeof p.elsewhere !== "string") { errors.push(`${at}: "elsewhere" should be text.`); return []; }
    return [{
      id: p.id, name: p.name.trim(), isPlaceholder: p.isPlaceholder !== false,
      ...(p.street !== undefined ? { street: p.street as number } : {}),
      ...(p.avenue !== undefined ? { avenue: p.avenue as AvenueId } : {}),
      ...(typeof p.elsewhere === "string" && p.elsewhere ? { elsewhere: p.elsewhere } : {}),
    }];
  });
  const events: TimelineEvent[] = (raw.events as unknown[]).flatMap((e, i) => {
    const at = isObj(e) && typeof e.title === "string" && e.title ? `"${e.title}"` : `Event ${i + 1}`;
    if (!isObj(e) || typeof e.id !== "string" || typeof e.title !== "string" || !e.title.trim()) { errors.push(`${at} needs an id and a title.`); return []; }
    if (typeof e.date !== "string") { errors.push(`${at} needs a date in quotes, like "1924" or "1924-03-15".`); return []; }
    if (e.placeId !== undefined && typeof e.placeId !== "string") { errors.push(`${at}: "placeId" should be a place id.`); return []; }
    if (e.appearsIn !== undefined && !strList(e.appearsIn)) { errors.push(`${at}: "appearsIn" should be a list of work addresses.`); return []; }
    return [{
      id: e.id, title: e.title.trim(), isPlaceholder: e.isPlaceholder !== false, date: e.date,
      ...(e.approximate === true ? { approximate: true } : {}),
      ...(typeof e.placeId === "string" && e.placeId ? { placeId: e.placeId } : {}),
      appearsIn: (e.appearsIn as string[] | undefined) ?? [],
    }];
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { isPlaceholder: raw.isPlaceholder !== false, places, events } };
}

/** Parse, shape-check and validate one atlas document typed in the Writer's Room. */
export function checkAtlas(kind: "lineage", text: string, knownWorks?: string[]): Checked<Lineage>;
export function checkAtlas(kind: "timeline", text: string, knownWorks?: string[]): Checked<Timeline>;
export function checkAtlas(kind: AtlasKind, text: string, knownWorks?: string[]): Checked<Lineage | Timeline>;
export function checkAtlas(kind: AtlasKind, text: string, knownWorks: string[] = []): Checked<Lineage | Timeline> {
  if (text.length > ATLAS_MAX_CHARS) return { ok: false, errors: [`That's over ${ATLAS_MAX_CHARS.toLocaleString("en-ZA")} characters — too large to save in one go.`] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`This isn't valid JSON yet: ${(e as Error).message}. Check for a missing comma, quote or bracket.`] };
  }
  if (kind === "lineage") {
    const c = coerceLineage(raw);
    if (!c.ok) return c;
    const errors = validateLineage(c.value, knownWorks);
    return errors.length ? { ok: false, errors } : c;
  }
  const c = coerceTimeline(raw);
  if (!c.ok) return c;
  const errors = validateTimeline(c.value, knownWorks);
  return errors.length ? { ok: false, errors } : c;
}

/** A stored document, or the file when there is none or it no longer checks out. */
export function storedOr<T>(kind: AtlasKind, stored: unknown, file: T): { value: T; fromLibrary: boolean } {
  if (stored === undefined || stored === null) return { value: file, fromLibrary: false };
  const c = kind === "lineage" ? coerceLineage(stored) : coerceTimeline(stored);
  return c.ok ? { value: c.value as T, fromLibrary: true } : { value: file, fromLibrary: false };
}

export const toAtlasText = (v: Lineage | Timeline) => JSON.stringify(v, null, 2);
