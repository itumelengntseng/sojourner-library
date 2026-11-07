import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { dueClock, dueWithinHour } from "@/lib/dueNotice";
import { DueWithinHour } from "@/components/DueWithinHour";

const now = Date.parse("2026-11-07T10:00:00Z"); // 12:00 SAST

describe("reading room: due back within the hour (C102)", () => {
  it("shows only inside the last hour of an open loan", () => {
    expect(dueWithinHour(now + 59 * 60_000, now)).toBe(true);
    expect(dueWithinHour(now + 3600_000, now)).toBe(true);
    expect(dueWithinHour(now + 3600_001, now)).toBe(false);
    expect(dueWithinHour(now - 1, now)).toBe(false);
    expect(dueWithinHour(0, now)).toBe(false);
  });
  it("stamps the due time on the SA clock", () => {
    expect(dueClock(Date.parse("2026-11-07T12:00:00Z"))).toBe("14:00");
    expect(dueClock(Date.parse("2026-11-07T21:05:00Z"))).toBe("23:05");
  });
  it("renders nothing on the server (the clock is read after mount)", () => {
    expect(renderToStaticMarkup(<DueWithinHour slug="w" dueAt={now + 60_000} />)).toBe("");
  });
  it("the reading room links it to the work's loan desk and leaves it out of the proof copy", () => {
    const src = readFileSync("components/ReaderView.tsx", "utf8");
    expect(src).toContain("{!proof && <DueWithinHour slug={slug} dueAt={data.dueAt} renewalsLeft={data.renewalsLeft} />}");
    expect(readFileSync("components/DueWithinHour.tsx", "utf8")).toContain("href={`/works/${slug}#desk`}");
  });
});

describe("no renewals left in the reading room (C106)", () => {
  it("the line says return, not renew, once every renewal is used", () => {
    const src = readFileSync("components/DueWithinHour.tsx", "utf8");
    expect(src).toContain("renewalsLeft === 0 ?");
    expect(src).toContain("no renewals left — <Link");
    expect(src).toContain("return at the desk");
  });
  it("the reading room loader passes the renewals left (preview and library)", () => {
    const src = readFileSync("lib/readingRoom.ts", "utf8");
    expect(src).toContain("renewalsLeft: Math.max(0, MAX_RENEWALS - loan.renewals)");
    expect(src).toContain('select("id, due_at, bookmark_offset, renewals, borrowed_at")');
  });
});
