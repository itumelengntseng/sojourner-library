// Pitch Room: a pitch kit per work, a one-pager, and private share links.
// Every word of a kit comes from Itu (content/pitches.ts); until then fields are placeholders.

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
