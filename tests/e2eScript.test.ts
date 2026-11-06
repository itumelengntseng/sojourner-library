import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const run = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, ["scripts/e2e.mjs", ...args], { env: { PATH: process.env.PATH ?? "", ...env }, encoding: "utf8" });

describe("end-to-end smoke script", () => {
  it("refuses to start without a target", () => {
    const r = run([]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/Set E2E_BASE/);
  });
  it("needs a saved sign-in for a library run, and never guesses one", () => {
    const r = run([], { E2E_BASE: "https://example.invalid", E2E_STATE: "/nonexistent/session.json" });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/--login first/);
  });
  it("rejects a malformed address", () => {
    expect(run([], { E2E_BASE: "example.org" }).stderr).toMatch(/must start with http/);
  });
});
