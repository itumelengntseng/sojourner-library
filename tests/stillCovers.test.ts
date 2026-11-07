import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readStill, STILL_ATTR, STILL_BOOT, STILL_KEY } from "@/lib/stillCovers";

const boot = (stored: string | null, throws = false) => {
  const attrs: Record<string, string> = {};
  const localStorage = { getItem: (k: string) => { if (throws) throw new Error("blocked"); return k === STILL_KEY ? stored : null; } };
  const document = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } } };
  new Function("localStorage", "document", STILL_BOOT)(localStorage, document);
  return attrs;
};

describe("C64 hold the covers still", () => {
  it("the head script sets the attribute only when this browser asked", () => {
    expect(boot("1")).toEqual({ [STILL_ATTR]: "" });
    expect(boot(null)).toEqual({});
    expect(boot("yes")).toEqual({});
    expect(boot("1", true)).toEqual({}); // storage blocked → no error, covers as the device prefers
  });
  it("readStill tolerates blocked storage", () => {
    expect(readStill(() => "1")).toBe(true);
    expect(readStill(() => { throw new Error("blocked"); })).toBe(false);
  });
  it("the stylesheet stills the covers under the attribute, as under reduced motion", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toContain("html[data-still-covers] .scene-cover .scene, html[data-still-covers] .scene-cover g { animation: none !important; }");
  });
});
