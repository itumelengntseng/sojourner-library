import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, zipStored } from "@/lib/zip";

const enc = new TextEncoder();
const u32 = (b: Uint8Array, at: number) => new DataView(b.buffer, b.byteOffset).getUint32(at, true);

describe("stored zip writer (C31)", () => {
  it("computes CRC-32 correctly", () => {
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
  it("writes local headers, a central directory and an end record", () => {
    const z = zipStored([{ name: "a.md", data: "# A" }, { name: "dir/b.json", data: "{}" }], new Date("2026-11-06T10:00:00Z"));
    expect(u32(z, 0)).toBe(0x04034b50);
    expect(u32(z, z.length - 22)).toBe(0x06054b50);
    expect(new DataView(z.buffer).getUint16(z.length - 22 + 10, true)).toBe(2);
  });
  it("keeps names safe and unique", () => {
    const z = zipStored([{ name: "../x.md", data: "1" }, { name: "/x.md", data: "2" }, { name: "x.md", data: "3" }]);
    const text = new TextDecoder().decode(z);
    expect(text).not.toContain("../");
    expect(text).toContain("_/x.md");
    expect(text).toContain("x-2.md");
  });
  it("opens in a standard unzip tool with identical contents (when python3 is available)", () => {
    let py = true;
    try { execFileSync("python3", ["--version"]); } catch { py = false; }
    if (!py) return;
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    const file = join(dir, "t.zip");
    writeFileSync(file, zipStored([{ name: "manuscripts/é.md", data: "# Placeholder — ünïcode\n" }, { name: "b.json", data: "[1]" }]));
    const out = execFileSync("python3", ["-I", "-c", "import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(z.read('manuscripts/é.md').decode())", file]).toString();
    expect(out.trim()).toBe("# Placeholder — ünïcode");
  });
});
