// Pitch kits. PLACEHOLDER ONLY — Itu writes the loglines, synopses, comparables and picks the
// sample excerpt. Set isPlaceholder to false when a kit is real. Contact stays empty until Itu adds it.
import type { PitchKit } from "@/lib/pitch";

const placeholder = (slug: string): PitchKit => ({
  slug,
  isPlaceholder: true,
  logline: "Placeholder logline. The author's one-sentence pitch will go here.",
  synopsis: "Placeholder synopsis. A short account of the work, in the author's words, will go here.",
  themes: ["Placeholder theme"],
  comparables: [],
  audience: "",
  formats: [],
  sample: "Placeholder excerpt. The author will choose the passage that opens the door.",
  authorNote: "Placeholder note from the author.",
  contact: "",
});

export const PITCHES: PitchKit[] = ["placeholder-work-one", "placeholder-work-two", "placeholder-work-three"].map(placeholder);

export function getPitch(slug: string): PitchKit | undefined {
  return PITCHES.find((p) => p.slug === slug);
}
