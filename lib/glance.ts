// The Writer's Room "library at a glance" — pure, so it can be tested without a server.
export interface GlanceTile { label: string; value: string; note?: string }

/** "The library at a glance": counts only — never who read what. */
export function glance(works: { visibility: "owner" | "members"; words: number; openLoans: number }[], setAside: number, cardHolders: number | null): GlanceTile[] {
  const shared = works.filter((w) => w.visibility === "members").length;
  const words = works.reduce((a, w) => a + w.words, 0);
  const loans = works.reduce((a, w) => a + w.openLoans, 0);
  const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-ZA")} ${n === 1 ? one : many}`;
  return [
    { label: "On the shelves", value: String(works.length), note: `${shared} shared · ${works.length - shared} only me${setAside ? ` · ${setAside} set aside` : ""}` },
    { label: "Words shelved", value: words.toLocaleString("en-ZA") },
    { label: "Card holders", value: cardHolders === null ? "—" : String(cardHolders), note: cardHolders === null ? "once the library is connected" : undefined },
    { label: "Out on loan now", value: String(loans), note: loans ? plural(loans, "open loan") : "every book is in" },
  ];
}
