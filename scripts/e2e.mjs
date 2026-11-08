// End-to-end smoke walk through the library, as the Keeper would use it.
//
//   Preview (no Supabase):  npm run build && npx next start -p 3200 &  then  npm run e2e -- --preview
//   Library (real Supabase, after NEEDS ITU 1):
//     1. Sign in once with your own browser profile and save the session:
//          E2E_BASE=https://<preview-url> node scripts/e2e.mjs --login
//        (opens a window; sign in at /card with your email link, then press Enter here).
//     2. E2E_BASE=https://<preview-url> npm run e2e
//
// The library run imports (or re-imports) one clearly-labelled placeholder work,
// "e2e-placeholder-check" — Draft, Only me — and never deletes anything. Every pitch
// link it makes is closed again before it finishes. Exit code 0 = every step passed.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const require = createRequire(import.meta.url);
const args = new Set(process.argv.slice(2));
const preview = args.has("--preview");
const BASE = (process.env.E2E_BASE ?? (preview ? "http://localhost:3200" : "")).replace(/\/$/, "");
const STATE = process.env.E2E_STATE ?? ".e2e-session.json"; // git-ignored; holds a sign-in cookie
const SLUG = preview ? "placeholder-work-one" : "e2e-placeholder-check";

function config() {
  if (!BASE) return { ok: false, message: "Set E2E_BASE to the preview URL (or pass --preview for a local preview build)." };
  if (!/^https?:\/\//.test(BASE)) return { ok: false, message: "E2E_BASE must start with http:// or https://." };
  if (!preview && !args.has("--login") && !existsSync(STATE)) return { ok: false, message: `No saved sign-in at ${STATE}. Run with --login first.` };
  return { ok: true };
}

const cfg = config();
if (!cfg.ok) {
  console.error(`e2e: ${cfg.message}`);
  process.exit(2);
}

const { chromium } = require("playwright");
const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push([true, name]);
    console.log(`✓ ${name}`);
  } catch (e) {
    results.push([false, name]);
    console.log(`✗ ${name}\n    ${String(e?.message ?? e).split("\n")[0]}`);
  }
}
const expectText = async (page, text) => {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 10_000 });
};

if (args.has("--login")) {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/card`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("Sign in in the window (follow your email link there), then press Enter here… ");
  rl.close();
  await ctx.storageState({ path: STATE });
  await browser.close();
  console.log(`Saved the session to ${STATE} (git-ignored). Now run: E2E_BASE=${BASE} npm run e2e`);
  process.exit(0);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, ...(preview ? {} : { storageState: STATE }) });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await step("front hall shows the author", async () => {
  await page.goto(`${BASE}/`);
  await expectText(page, "Itumeleng Ntseng");
});

if (!preview) {
  await step("signed in: the card shows", async () => {
    await page.goto(`${BASE}/card`);
    await expectText(page, "Itumeleng Ntseng");
  });
  await step("Writer's Room: shelve the placeholder check work", async () => {
    await page.goto(`${BASE}/writers-room`);
    await page.locator('input[name="title"]').fill("E2E Placeholder Check");
    await page.locator('textarea[name="manuscript"]').fill("# E2E Placeholder Check\n\n## Chapter 1\n\nPlaceholder text for the end-to-end check.\n\n## Chapter 2\n\nMore placeholder text.\n");
    await page.getByRole("button", { name: "Save to the library" }).click();
    await expectText(page, "Saved");
  });
  await step("proof copy opens without a loan", async () => {
    await page.goto(`${BASE}/works/${SLUG}/proof`);
    await expectText(page, "Proof copy");
  });
}

await step("borrow at the loan desk", async () => {
  await page.goto(`${BASE}/works/${SLUG}`);
  const open = page.getByRole("link", { name: /Start reading|Open the reading room|Resume at your bookmark/ });
  if (!(await open.count())) {
    await page.getByRole("button", { name: "Borrow this work" }).click();
    await open.first().waitFor({ timeout: 10_000 });
  }
});

await step("read: bookmark and a margin note", async () => {
  await page.goto(`${BASE}/works/${SLUG}/read`);
  await page.getByRole("button", { name: "Bookmark here" }).click();
  await expectText(page, "Bookmark placed");
  await page.getByRole("button", { name: "Note", exact: true }).click();
  await page.locator("#note-draft").fill("E2E placeholder note.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expectText(page, "E2E placeholder note.");
  // C187: the status line says the note was saved, with the book's own count.
  await page.getByRole("status").filter({ hasText: /^Note saved · \d+ in this book$/ }).first().waitFor({ timeout: 10_000 });
});

await step("read: a highlight says it was saved, and removed", async () => {
  // C188: select a few words of the first unhighlighted passage and highlight them.
  await page.evaluate(() => {
    const el = document.querySelector("[data-para] span[data-start]");
    const text = el?.firstChild;
    if (!text || !text.textContent || text.textContent.length < 12) throw new Error("no passage to select");
    const r = document.createRange();
    r.setStart(text, 0); r.setEnd(text, 10);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  });
  await page.getByRole("button", { name: "Highlight in lamplight" }).click();
  await page.getByRole("status").filter({ hasText: /^Highlight saved · \d+ in this book$/ }).first().waitFor({ timeout: 10_000 });
  // C191: removing it says what's left in the book.
  const remove = page.getByRole("button", { name: "Remove highlight" }).last();
  await remove.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("status").filter({ hasText: /^Highlight removed · (\d+|none) left in this book$/ }).first().waitFor({ timeout: 10_000 });
});

await step("read: a chapter without notes says how many are elsewhere", async () => {
  // C207/C211: from Contents, open a chapter that holds none of this reader's notes (the note above sits elsewhere).
  await page.locator("summary", { hasText: "Contents" }).click();
  const items = page.getByRole("navigation", { name: "Contents" }).locator("li");
  const n = await items.count();
  let href = null;
  for (let i = 0; i < n && !href; i++) {
    const li = items.nth(i);
    if ((await li.locator("a[aria-current='page']").count()) || (await li.getByText(/ · \d+ (notes?|highlights?)/).count())) continue;
    href = await li.locator("a").getAttribute("href");
  }
  if (!href) throw new Error("no chapter without notes to open (the book needs two chapters)");
  await page.goto(`${BASE}${href}`);
  await page.locator("[data-notes-elsewhere]", { hasText: /^No notes in this chapter yet · \d+ elsewhere in this book · see Contents$/ }).waitFor({ timeout: 10_000 });
});

await step("ledger: notes export includes the note", async () => {
  await page.goto(`${BASE}/ledger`);
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 10_000 }),
    page.getByText("Export my notes (Markdown)").first().click(),
  ]);
  const path = await dl.path();
  const text = path ? require("node:fs").readFileSync(path, "utf8") : "";
  if (!text.includes("E2E placeholder note.")) throw new Error("the export doesn't contain the note");
});

if (!preview) {
  await step("pitch link: make, open without a card, close", async () => {
    await page.goto(`${BASE}/pitch-room`);
    const item = page.locator("li").filter({ hasText: "E2E Placeholder Check" }).first();
    await item.locator('input[name="note"]').fill("e2e check");
    await item.getByRole("button", { name: "Make a private link" }).click();
    const url = (await item.locator(".select-all").first().textContent({ timeout: 10_000 }))?.trim();
    if (!url?.includes("/p/")) throw new Error("no link shown");
    const stranger = await browser.newContext();
    const sp = await stranger.newPage();
    await sp.goto(url);
    await expectText(sp, "Itumeleng Ntseng");
    await stranger.close();
    await page.reload();
    await page.locator("li").filter({ hasText: "e2e check" }).getByRole("button", { name: "Close link" }).first().click();
    await expectText(page, "Link closed");
  });
}

await step("return to shelf", async () => {
  await page.goto(`${BASE}/works/${SLUG}`);
  await page.getByRole("button", { name: "Return to shelf" }).click();
  await page.getByRole("button", { name: "Borrow this work" }).waitFor({ timeout: 10_000 });
});

await step("no page errors along the way", async () => {
  if (errors.length) throw new Error(errors.join(" | "));
});

await browser.close();
const failed = results.filter(([ok]) => !ok).length;
console.log(failed ? `\n${failed} step(s) failed.` : `\nAll ${results.length} steps passed (${preview ? "preview" : "library"} mode).`);
process.exit(failed ? 1 : 0);
