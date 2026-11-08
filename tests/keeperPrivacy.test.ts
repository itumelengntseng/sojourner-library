import { beforeEach, describe, expect, it, vi } from "vitest";

// C241: the front hall's Keeper line never reads the atlas, pitch kits or halls for anyone but the Keeper.
const calls = { atlas: 0, pitches: 0, catalogue: 0 };
let who: { supabase: unknown; reason: string | null } = { supabase: null, reason: "signed-out" };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/writersRoom", () => ({ ownerClient: async () => who }));
vi.mock("@/lib/atlasStore", () => ({ loadAtlas: async () => { calls.atlas++; return { lineage: { people: [] }, timeline: { places: [], events: [] } }; } }));
vi.mock("@/lib/pitchStore", () => ({ roomPitches: async () => { calls.pitches++; return { pitches: [] }; } }));
vi.mock("@/lib/catalogueServer", () => ({ loadCatalogue: async () => { calls.catalogue++; return { works: [] }; } }));

const { keeperWaiting } = await import("@/lib/waitingStore");

describe("Keeper line privacy (C241)", () => {
  beforeEach(() => { calls.atlas = calls.pitches = calls.catalogue = 0; });
  it("signed-out visitors and guests get null, and nothing is read", async () => {
    for (const reason of ["signed-out", "not-owner"]) {
      who = { supabase: null, reason };
      expect(await keeperWaiting()).toBeNull();
    }
    expect(calls).toEqual({ atlas: 0, pitches: 0, catalogue: 0 });
  });
  it("the Keeper (and preview) get the counts", async () => {
    who = { supabase: null, reason: "preview" };
    expect(await keeperWaiting()).toEqual({ rows: [{ key: "halls", text: "the halls' names", short: "the hall names", href: "#halls", linkLabel: "name the halls" }], allDone: false });
    const halls = { from: () => ({ select: () => Promise.resolve({ count: 2 }) }) };
    who = { supabase: halls, reason: null };
    expect(await keeperWaiting()).toEqual({ rows: [], allDone: true });
    expect(calls.atlas).toBe(2);
  });
});
