// Reading-room keyboard shortcuts — one table drives both the key handler and the help card.
export type ReaderKeyAction = "prevPage" | "nextPage" | "contents" | "bookmark" | "note" | "larger" | "smaller" | "layout" | "help";

export interface Shortcut { keys: string[]; label: string; action: ReaderKeyAction; proof: boolean }

export const SHORTCUTS: readonly Shortcut[] = [
  { keys: ["←", "→"], label: "Turn the page (paged layout)", action: "nextPage", proof: true },
  { keys: ["C"], label: "Open or close the contents", action: "contents", proof: true },
  { keys: ["P"], label: "Switch between paged and scroll", action: "layout", proof: true },
  { keys: ["+", "−"], label: "Larger or smaller text", action: "larger", proof: true },
  { keys: ["B"], label: "Bookmark here", action: "bookmark", proof: false },
  { keys: ["N"], label: "Write a margin note", action: "note", proof: false },
  { keys: ["?"], label: "Show these keys", action: "help", proof: true },
  { keys: ["Esc"], label: "Close this card or the contents", action: "help", proof: true },
];

/** Shortcuts that apply here (the proof copy has no bookmark or notes). */
export function shortcutsFor(proof: boolean): Shortcut[] {
  return SHORTCUTS.filter((s) => !proof || s.proof);
}

/** Which action a key press means, or null. Ignores presses with Ctrl/Alt/Meta so browser shortcuts still work. */
export function actionForKey(e: { key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }, proof: boolean): ReaderKeyAction | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null;
  const map: Record<string, ReaderKeyAction> = {
    ArrowLeft: "prevPage", ArrowRight: "nextPage", c: "contents", C: "contents", p: "layout", P: "layout",
    "+": "larger", "=": "larger", "-": "smaller", "_": "smaller", "?": "help",
    b: "bookmark", B: "bookmark", n: "note", N: "note",
  };
  const a = map[e.key] ?? null;
  if (proof && (a === "bookmark" || a === "note")) return null;
  return a;
}
