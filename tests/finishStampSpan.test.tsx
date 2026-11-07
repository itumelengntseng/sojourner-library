import { describe, expect, it, vi } from "vitest";

// C86: the work page's "You finished this" stamp says how long the book took (own sessions only).
let cookieValue: string | undefined;
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookieValue === undefined ? undefined : { value: cookieValue }) }) }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => null }));

import { myFirstRead } from "@/lib/ledgerStore";
import { finishedStampLine } from "@/lib/ledger";

const at = (iso: string) => Date.parse(iso);

describe("work page finished stamp with how long it took (C86)", () => {
  it("reads the stamp with the span when the first session is known", () => {
    expect(finishedStampLine(at("2026-11-09T10:00:00Z"), at("2026-11-01T10:00:00Z"))).toMatch(/^You finished this · 0?9 Nov 2026 · read over 9 days$/);
    expect(finishedStampLine(at("2026-11-09T10:00:00Z"), at("2026-11-09T07:00:00Z"))).toMatch(/· read in a day$/);
    expect(finishedStampLine(at("2026-11-09T10:00:00Z"))).toMatch(/^You finished this · 0?9 Nov 2026$/);
  });
  it("finds the reader's first session in this book only (preview cookie)", async () => {
    cookieValue = JSON.stringify([
      { id: "a", slug: "placeholder-work-one", position: 2, wordsRead: 10, activeMs: 60_000, endedAt: 5_000 },
      { id: "b", slug: "placeholder-work-two", position: 1, wordsRead: 10, activeMs: 60_000, endedAt: 1_000 },
      { id: "c", slug: "placeholder-work-one", position: 1, wordsRead: 10, activeMs: 60_000, endedAt: 3_000 },
    ]);
    expect(await myFirstRead("placeholder-work-one")).toBe(3_000);
    expect(await myFirstRead("placeholder-work-three")).toBeUndefined();
    cookieValue = undefined;
    expect(await myFirstRead("placeholder-work-one")).toBeUndefined();
  });
});
