"use client";

import { useEffect, useState } from "react";
import { readStill, STILL_ATTR, STILL_KEY } from "@/lib/stillCovers";

// C64: in the footer — "Still covers" / "Living covers", remembered in this browser.
export function StillCoversToggle() {
  const [still, setStill] = useState<boolean | null>(null);
  useEffect(() => { setStill(readStill((k) => localStorage.getItem(k))); }, []);
  if (still === null) return null; // nothing to show until we know this browser's choice
  const flip = () => {
    const next = !still;
    setStill(next);
    try { if (next) localStorage.setItem(STILL_KEY, "1"); else localStorage.removeItem(STILL_KEY); } catch { /* private mode: this page only */ }
    if (next) document.documentElement.setAttribute(STILL_ATTR, ""); else document.documentElement.removeAttribute(STILL_ATTR);
  };
  return (
    <button type="button" onClick={flip} aria-pressed={still} className="underline-offset-2 hover:underline">
      {still ? "Covers held still" : "Hold the covers still"}
    </button>
  );
}
