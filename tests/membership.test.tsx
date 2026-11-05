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
