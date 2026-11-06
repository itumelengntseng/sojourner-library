import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { canonHref, outsideCanonNote, resolveCanonView } from "@/lib/canon";
import { CanonToggle } from "@/components/CanonToggle";
import { proxy } from "@/proxy";

describe("canon switch", () => {
  it("lets a link win, then the remembered choice, then canon only", () => {
    expect(resolveCanonView("all", "canon")).toBe("all");
    expect(resolveCanonView("canon", "all")).toBe("canon");
    expect(resolveCanonView(undefined, "all")).toBe("all");
    expect(resolveCanonView(["all", "canon"], undefined)).toBe("all");
    expect(resolveCanonView("nonsense", "junk")).toBe("canon");
    expect(resolveCanonView(undefined, undefined)).toBe("canon");
  });
  it("makes explicit links so the choice can be switched back", () => {
    expect(canonHref("/halls", "canon")).toBe("/halls?canon=canon");
    const html = renderToStaticMarkup(<CanonToggle view="all" basePath="/lineage" />);
    expect(html).toContain('href="/lineage?canon=canon"');
    expect(html).toContain('href="/lineage?canon=all"');
  });
  it("explains works outside the canon", () => {
    expect(outsideCanonNote("canon")).toBeNull();
    expect(outsideCanonNote("draft")).toMatch(/draft/);
    expect(outsideCanonNote("apocrypha")).toMatch(/outside the canon/);
  });
  it("remembers the choice in a cookie when a canon link is followed", async () => {
    const res = await proxy(new NextRequest("http://localhost/halls?canon=all"));
    expect(res.cookies.get("soj_canon")?.value).toBe("all");
    const none = await proxy(new NextRequest("http://localhost/halls?canon=evil"));
    expect(none.cookies.get("soj_canon")).toBeUndefined();
  });
});
