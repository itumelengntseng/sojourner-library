import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  formatCardNumber, friendlyRedeemError, isPlausibleEmail, isPlausibleInviteCode, normalizeInviteCode, roleLabel,
} from "@/lib/membership";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { safeNextPath } from "@/lib/safeRedirect";
import { MembershipCard } from "@/components/MembershipCard";

describe("membership helpers", () => {
  it("names the two standings", () => {
    expect(roleLabel("owner")).toBe("Keeper of the Library");
    expect(roleLabel("guest")).toBe("Guest Reader");
  });
  it("prints card numbers in groups of four", () => {
    expect(formatCardNumber("1a2b3c4d5e")).toBe("1A2B 3C4D 5E");
  });
  it("normalises invite codes the same way the database does", () => {
    expect(normalizeInviteCode(" soj-12ab cd34-ef56 ")).toBe("SOJ12ABCD34EF56");
    expect(isPlausibleInviteCode("soj-12ab-cd34-ef56")).toBe(true);
    expect(isPlausibleInviteCode("SOJ-1234")).toBe(false);
    expect(isPlausibleInviteCode("XYZ-12AB-CD34-EF56")).toBe(false);
  });
  it("checks emails loosely", () => {
    expect(isPlausibleEmail("itu@example.com")).toBe(true);
    expect(isPlausibleEmail("not an email")).toBe(false);
  });
  it("turns database errors into plain words and hides unknown ones", () => {
    expect(friendlyRedeemError("ERROR: that invite has expired")).toMatch(/expired/);
    expect(friendlyRedeemError("ERROR: that invite has already been used")).toMatch(/already been used/);
    expect(friendlyRedeemError("relation x does not exist")).not.toMatch(/relation/);
  });
});

describe("supabase env", () => {
  it("stays dormant until both values are set", () => {
    expect(readSupabaseEnv({})).toBeNull();
    expect(readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" })).toBeNull();
    expect(readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://x", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })).toBeNull();
    expect(readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" }))
      .toEqual({ url: "https://x.supabase.co", anonKey: "k" });
  });
});

describe("safe redirects", () => {
  it("keeps readers on this site", () => {
    expect(safeNextPath("/halls")).toBe("/halls");
    expect(safeNextPath("//evil.example")).toBe("/card");
    expect(safeNextPath("https://evil.example")).toBe("/card");
    expect(safeNextPath("/\\evil")).toBe("/card");
    expect(safeNextPath(null)).toBe("/card");
  });
});

describe("MembershipCard", () => {
  const html = renderToStaticMarkup(
    <MembershipCard card={{ id: "x", role: "guest", display_name: "Thandi", card_number: "1A2B3C4D5E", created_at: "2026-11-05T10:00:00Z" }} />,
  );
  it("shows the reader's details", () => {
    expect(html).toContain("Thandi");
    expect(html).toContain("Guest Reader");
    expect(html).toContain("1A2B 3C4D 5E");
    expect(html).toContain("2026");
  });
  it("carries the author's name", () => {
    expect(html).toContain("Itumeleng Ntseng");
  });
});

import { checkPrefs } from "@/lib/membership";
import { addUser, asUser, freshDb } from "./helpers/db";

describe("card preferences", () => {
  it("keeps a tidy name and a fixed pace in range", () => {
    expect(checkPrefs("  Placeholder   Reader ", "260", null)).toEqual({ ok: true, displayName: "Placeholder Reader", wpmOverride: 260 });
    expect(checkPrefs("P", "", null)).toEqual({ ok: true, displayName: "P", wpmOverride: null });
    expect(checkPrefs("P", "260", "on")).toEqual({ ok: true, displayName: "P", wpmOverride: null });
  });
  it("refuses odd paces and long names", () => {
    expect(checkPrefs("P", "20", null).ok).toBe(false);
    expect(checkPrefs("P", "2000", null).ok).toBe(false);
    expect(checkPrefs("P", "250.5", null).ok).toBe(false);
    expect(checkPrefs("x".repeat(61), "", null).ok).toBe(false);
  });
  it("a reader can change only their own name and pace", async () => {
    const db = await freshDb();
    const A = "00000000-0000-0000-0000-0000000000f7";
    const B = "00000000-0000-0000-0000-0000000000f8";
    await addUser(db, A, "guest", "A");
    await addUser(db, B, "guest", "B");
    await asUser(db, A, (tx) => tx.query(`update readers set display_name = 'Placeholder A', wpm_override = 300 where id = $1`, [A]));
    const n = await asUser(db, A, async (tx) => (await tx.query(`update readers set wpm_override = 999 where id = $1 returning id`, [B])).rows.length);
    expect(n).toBe(0);
    const rows = (await db.query<{ id: string; display_name: string; wpm_override: number | null }>(`select id, display_name, wpm_override from readers order by id`)).rows;
    expect(rows).toEqual([{ id: A, display_name: "Placeholder A", wpm_override: 300 }, { id: B, display_name: "B", wpm_override: null }]);
  }, 30_000);
});
