// The lineage file. PLACEHOLDER ONLY — Itu will supply the real people and relations.
// To fill it in: give each person an id (lower-case-with-hyphens), a name, their parents'
// ids (up to two), partners' ids, and the slugs of the works they appear in. Set
// isPlaceholder to false for real entries. `npm test` checks the file for mistakes.
import type { Lineage } from "@/lib/lineage";

const P = (id: string, name: string, parents: string[] = [], partners: string[] = [], appearsIn: string[] = []) =>
  ({ id, name, isPlaceholder: true, parents, partners, appearsIn, note: "Placeholder — not part of the canon." });

export const LINEAGE: Lineage = {
  title: "The family wall",
  isPlaceholder: true,
  people: [
    P("placeholder-elder-a", "Placeholder Elder A", [], ["placeholder-elder-b"], ["placeholder-work-one"]),
    P("placeholder-elder-b", "Placeholder Elder B", [], [], ["placeholder-work-one"]),
    P("placeholder-elder-c", "Placeholder Elder C", [], [], ["placeholder-work-two"]),
    P("placeholder-child-a", "Placeholder Child A", ["placeholder-elder-a", "placeholder-elder-b"], ["placeholder-child-c"], ["placeholder-work-one", "placeholder-work-two"]),
    P("placeholder-child-b", "Placeholder Child B", ["placeholder-elder-a", "placeholder-elder-b"], [], ["placeholder-work-three"]),
    P("placeholder-child-c", "Placeholder Child C", ["placeholder-elder-c"], [], ["placeholder-work-two"]),
    P("placeholder-grandchild-a", "Placeholder Grandchild A", ["placeholder-child-a", "placeholder-child-c"], [], ["placeholder-work-two"]),
  ],
};
