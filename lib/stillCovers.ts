// C64: a per-browser "Still covers" switch — the living covers hold still even when the device
// doesn't ask for reduced motion. Kept in localStorage; the attribute is set before first paint.
export const STILL_KEY = "soj:still-covers";
export const STILL_ATTR = "data-still-covers";

/** Runs inline in <head> so the covers never start moving for someone who asked them not to. */
export const STILL_BOOT = `try{if(localStorage.getItem(${JSON.stringify(STILL_KEY)})==="1")document.documentElement.setAttribute(${JSON.stringify(STILL_ATTR)},"")}catch(e){}`;

export function readStill(get: (k: string) => string | null): boolean {
  try { return get(STILL_KEY) === "1"; } catch { return false; }
}
