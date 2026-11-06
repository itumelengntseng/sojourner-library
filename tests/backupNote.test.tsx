import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BackupEverything } from "@/components/BackupEverything";
import { backupNote, parseLastBackup } from "@/lib/backupNote";

const NOW = Date.parse("2026-11-06T12:30:00Z"); // 14:30 SAST
const DAY = 86_400_000;

describe("last backed up (C35)", () => {
  it("reads only sane stored times", () => {
    expect(parseLastBackup(null, NOW)).toBeNull();
    expect(parseLastBackup("", NOW)).toBeNull();
    expect(parseLastBackup("nonsense", NOW)).toBeNull();
    expect(parseLastBackup("-5", NOW)).toBeNull();
    expect(parseLastBackup(String(NOW + DAY), NOW)).toBeNull();
    expect(parseLastBackup(String(NOW - DAY), NOW)).toBe(NOW - DAY);
  });
  it("says when nothing has been backed up from this browser", () => {
    const n = backupNote(null, NOW);
    expect(n.text).toBe("Not backed up from this browser yet.");
    expect(n.remind).toMatch(/Download a copy/);
  });
  it("stamps the last backup in SA time, with no reminder inside 30 days", () => {
    const n = backupNote(NOW, NOW);
    expect(n.text).toContain("6 Nov 2026");
    expect(n.text).toContain("14:30");
    expect(n.text).toContain("from this browser");
    expect(backupNote(NOW - 29 * DAY, NOW).remind).toBeNull();
  });
  it("gently reminds after 30 days", () => {
    expect(backupNote(NOW - 30 * DAY, NOW).remind).toBe("That was 30 days ago — a fresh copy would be wise.");
    expect(backupNote(NOW - 45 * DAY, NOW).remind).toContain("45 days");
  });
  it("keeps the download button (owner route, download attribute) and a status line", () => {
    const html = renderToStaticMarkup(<BackupEverything />);
    expect(html).toContain('href="/writers-room/backup"');
    expect(html).toContain("download");
    expect(html).toContain("Back up everything (.zip)");
    expect(html).toContain('role="status"');
  });
});
