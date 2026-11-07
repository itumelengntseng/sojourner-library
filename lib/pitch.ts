// Pitch Room: a pitch kit per work, a one-pager, and private share links.
// Every word of a kit comes from Itu (content/pitches.ts); until then fields are placeholders.
import { withAuthor } from "./catalogueRows";
import { DEFAULT_WPM, formatDuration, minutesFor } from "./engine/readingTime";

export interface PitchKit {
  slug: string; // the work
  isPlaceholder: boolean;
  logline: string;
  synopsis: string;
  themes: string[];
  comparables: string[]; // "X meets Y" titles the author chooses
  audience: string;
  formats: string[]; // e.g. novel, series, film
  sample: string; // an excerpt the author picks; never pulled from the manuscript automatically
  authorNote: string;
  contact: string; // shown on share links only if filled in
}

export const REQUIRED_FIELDS: (keyof PitchKit)[] = ["logline", "synopsis", "sample", "authorNote"];

export interface KitStatus {
  ready: boolean;
  missing: string[];
  placeholder: boolean;
}

const LABELS: Record<string, string> = { logline: "logline", synopsis: "synopsis", sample: "sample excerpt", authorNote: "author's note" };

export function kitStatus(k: PitchKit): KitStatus {
  const missing = REQUIRED_FIELDS.filter((f) => !String(k[f] ?? "").trim()).map((f) => LABELS[f] ?? f);
  return { ready: missing.length === 0 && !k.isPlaceholder, missing, placeholder: k.isPlaceholder };
}

export const LOGLINE_MAX_WORDS = 50;

export function loglineWarning(logline: string): string | null {
  const n = logline.trim().split(/\s+/).filter(Boolean).length;
  return n > LOGLINE_MAX_WORDS ? `The logline runs ${n} words; pitches land best under ${LOGLINE_MAX_WORDS}.` : null;
}

/** A Markdown one-pager, authorship first. */
export function onePager(k: PitchKit, work: { title: string; author: string; words: number; readingTime: string }): string {
  const lines = [
    `# ${work.title}`,
    ``,
    `**by ${work.author}**`,
    ``,
    ...(k.isPlaceholder ? [`> Placeholder pitch — the author's own words will replace this.`, ``] : []),
    `## Logline`, ``, k.logline, ``,
    `## Synopsis`, ``, k.synopsis, ``,
    ...(k.themes.length ? [`## Themes`, ``, ...k.themes.map((t) => `- ${t}`), ``] : []),
    ...(k.comparables.length ? [`## Comparable titles`, ``, ...k.comparables.map((t) => `- ${t}`), ``] : []),
    ...(k.audience ? [`## Audience`, ``, k.audience, ``] : []),
    ...(k.formats.length ? [`## Formats`, ``, k.formats.join(" · "), ``] : []),
    `## At a glance`, ``, `${work.words.toLocaleString("en-ZA").replace(/\s/g, " ")} words · about ${work.readingTime} to read`, ``,
    `## From the work`, ``, ...k.sample.split(/\n{2,}/).map((p) => `> ${p.replace(/\n/g, " ")}\n`), ``,
    `## From the author`, ``, k.authorNote, ``,
    ...(k.contact ? [`## Contact`, ``, k.contact, ``] : []),
    `---`, `© ${work.author}. Shared privately; please don't forward.`,
  ];
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** Share-link tokens: 32 url-safe chars; only a hash is ever stored. */
export const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
export function isPlausibleToken(t: string): boolean {
  return TOKEN_RE.test(t);
}

// ── Editing kits in the Writer's Room ─────────────────────────────────────────

/** A kit with nothing in it yet — for works that have no kit. Nothing is invented. */
export function blankKit(slug: string): PitchKit {
  return { slug, isPlaceholder: true, logline: "", synopsis: "", themes: [], comparables: [], audience: "", formats: [], sample: "", authorNote: "", contact: "" };
}

export const KIT_LIMITS = { logline: 600, synopsis: 6000, audience: 600, sample: 8000, authorNote: 3000, contact: 300, listItems: 12, listItem: 120 } as const;

const tidy = (v: unknown) => String(v ?? "").replace(/\r\n?/g, "\n").trim();
/** One item per line (commas also accepted for short lists); blanks and repeats dropped. */
export function parseList(v: unknown): string[] {
  const raw = tidy(v);
  const parts = raw.includes("\n") ? raw.split("\n") : raw.split(",");
  const out: string[] = [];
  for (const p of parts.map((s) => s.trim()).filter(Boolean)) if (!out.includes(p)) out.push(p);
  return out;
}

export type KitResult = { ok: true; kit: PitchKit } | { ok: false; errors: string[] };

/** Validates the Writer's Room kit form. `get` reads a form field. */
export function kitFromForm(slug: string, get: (name: string) => unknown): KitResult {
  const errors: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) errors.push("That isn't a work address.");
  const text = (name: keyof typeof KIT_LIMITS, label: string) => {
    const v = tidy(get(name));
    if (v.length > KIT_LIMITS[name]) errors.push(`The ${label} is ${v.length} characters; keep it under ${KIT_LIMITS[name]}.`);
    return v;
  };
  const list = (name: string, label: string) => {
    const v = parseList(get(name));
    if (v.length > KIT_LIMITS.listItems) errors.push(`Keep ${label} to ${KIT_LIMITS.listItems} or fewer.`);
    if (v.some((x) => x.length > KIT_LIMITS.listItem)) errors.push(`Each of the ${label} should be under ${KIT_LIMITS.listItem} characters.`);
    return v;
  };
  const kit: PitchKit = {
    slug,
    // Only the author can say a kit is in their own words: it stays a placeholder unless ticked.
    isPlaceholder: get("ownWords") !== "on",
    logline: text("logline", "logline"),
    synopsis: text("synopsis", "synopsis"),
    themes: list("themes", "themes"),
    comparables: list("comparables", "comparable titles"),
    audience: text("audience", "audience"),
    formats: list("formats", "formats"),
    sample: text("sample", "sample excerpt"),
    authorNote: text("authorNote", "author's note"),
    contact: text("contact", "contact"),
  };
  return errors.length ? { ok: false, errors } : { ok: true, kit };
}

export interface KitRow {
  work_slug: string; is_placeholder: boolean; logline: string; synopsis: string; themes: string[];
  comparables: string[]; audience: string; formats: string[]; sample: string; author_note: string; contact: string;
}

export function kitToRow(k: PitchKit): KitRow {
  return {
    work_slug: k.slug, is_placeholder: k.isPlaceholder, logline: k.logline, synopsis: k.synopsis, themes: k.themes,
    comparables: k.comparables, audience: k.audience, formats: k.formats, sample: k.sample, author_note: k.authorNote, contact: k.contact,
  };
}

export function kitFromRow(r: KitRow): PitchKit {
  return {
    slug: r.work_slug, isPlaceholder: r.is_placeholder !== false, logline: r.logline ?? "", synopsis: r.synopsis ?? "",
    themes: r.themes ?? [], comparables: r.comparables ?? [], audience: r.audience ?? "", formats: r.formats ?? [],
    sample: r.sample ?? "", authorNote: r.author_note ?? "", contact: r.contact ?? "",
  };
}

/** Which kit to show: the stored one wins, then the file kit, then a blank one. */
export function chooseKit(slug: string, stored: PitchKit | undefined, file: PitchKit | undefined): PitchKit {
  return stored ?? file ?? blankKit(slug);
}

export interface PitchWork { title: string; author: string; words: number; readingTime: string }

export function pitchWork(slug: string, w: { title: string; author: string | null; words: number } | undefined): PitchWork {
  const words = w?.words ?? 0;
  return { title: w?.title ?? slug, author: withAuthor(w?.author), words, readingTime: formatDuration(minutesFor(words, DEFAULT_WPM)) };
}

export type SharedRow = { work_slug: string; title: string | null; author: string | null; word_count: number | null; has_kit: boolean | null } & Partial<KitRow>;

export function sharedPitch(row: SharedRow, fileKit: PitchKit | undefined): { kit: PitchKit; work: PitchWork } {
  const kit = chooseKit(row.work_slug, row.has_kit ? kitFromRow({ ...(row as KitRow), work_slug: row.work_slug }) : undefined, fileKit);
  return { kit, work: pitchWork(row.work_slug, { title: row.title ?? row.work_slug, author: row.author ?? "", words: row.word_count ?? 0 }) };
}

/** "never opened" or "last opened 6 Nov 2026, 14:32" (SA time) — the only visitor detail the library keeps. */
export function lastOpened(iso: string | null): string {
  if (!iso) return "never opened";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "never opened";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Africa/Johannesburg" })
    .formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  const date = `${Number(parts.day)} ${parts.month} ${parts.year}`;
  const time = `${parts.hour}:${parts.minute}`;
  return `last opened ${date}, ${time}`;
}

/**
 * C123: how long an open share link has left — "open until 21 Nov · 14 days left", counted in SA
 * calendar days; "open until 21 Nov · last day" on its final day. Null once it has run out.
 */
export function linkTimeLeft(expiresIso: string, now: number): string | null {
  const t = Date.parse(expiresIso);
  if (!Number.isFinite(t) || t <= now) return null;
  const day = (ms: number) => Math.floor((ms + 2 * 3600_000) / 86_400_000); // SAST is UTC+2, no DST
  const left = day(t) - day(now);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Johannesburg" })
    .formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  const until = `open until ${Number(parts.day)} ${parts.month}`;
  return `${until} · ${left <= 0 ? "last day" : `${left} day${left === 1 ? "" : "s"} left`}`;
}

/** C125: the closing time of a share link on its last day — "Last day: closes 18:30" (SA time); null on any other day. */
export function lastDayLabel(expiresIso: string, now: number): string | null {
  if (!linkTimeLeft(expiresIso, now)?.endsWith("· last day")) return null;
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Africa/Johannesburg" }).format(new Date(Date.parse(expiresIso)));
  return `Last day: closes ${time}`;
}

/** C130: a kit's share links, open ones first (soonest closing first), then closed/expired (newest first, as given). */
export function orderLinks<T extends { expiresAt: string; revoked: boolean }>(links: T[], now: number): { links: T[]; open: number; closingToday: number } {
  const isOpen = (l: T) => !l.revoked && linkTimeLeft(l.expiresAt, now) !== null;
  const open = links.filter(isOpen).sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
  // C133: how many open links are on their last day.
  const closingToday = open.filter((l) => lastDayLabel(l.expiresAt, now) !== null).length;
  return { links: [...open, ...links.filter((l) => !isOpen(l))], open: open.length, closingToday };
}

/** C138: a share link opened within the last hour. */
export function openedJustNow(iso: string | null, now: number): boolean {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) && t <= now && now - t < 3600_000;
}
