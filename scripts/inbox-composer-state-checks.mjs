import { chromium } from "@playwright/test";
import { join } from "path";

const BASE = "http://localhost:3000";
const API = "http://localhost:4000";
const OUT_DIR = "/Users/yavuz/Desktop/helvino/inbox-screenshot";

async function loginAndSeedCookie(context) {
  const loginRes = await fetch(`${API}/portal/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@test.com", password: "Test1234!" }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`);
  const cookies = loginRes.headers.get("set-cookie");
  const match = cookies?.match(/helvino_portal_sid=([^;]+)/);
  if (!match) throw new Error("Session cookie missing");
  await context.addCookies([{ name: "helvino_portal_sid", value: match[1], domain: "localhost", path: "/" }]);
}

async function openConversation(page) {
  const selectors = [
    `div[role="button"].cursor-pointer.mx-2.my-1`,
    `div[role="button"].cursor-pointer`,
    `[role="button"]`,
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    const ok = await el.isVisible({ timeout: 1500 }).catch(() => false);
    if (!ok) continue;
    const clicked = await el.click({ timeout: 2500 }).then(() => true).catch(() => false);
    if (clicked) {
      await page.waitForTimeout(1200);
      return sel;
    }
  }
  return "none";
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  await loginAndSeedCookie(context);
  await page.goto(`${BASE}/portal/inbox`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(1800);
  const clickedWith = await openConversation(page);

  // Ensure center chat opened (toolbar visible)
  const toolbarVisible = await page.locator('button:has-text("🤖")').first().isVisible({ timeout: 3500 }).catch(() => false);
  if (!toolbarVisible) throw new Error(`Conversation did not open (clickedWith=${clickedWith})`);

  // Bring composer/quick-replies into view.
  await page.evaluate(() => {
    const form = document.querySelector('div[role="form"]');
    if (form) form.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(400);

  const quickReplyButtons = page.locator('button[style*="border-radius: 16px"]');
  const textarea = page.locator('div[role="form"] textarea').first();
  const sendBtn = page.locator('div[role="form"] button').last();
  const noteBtn = page.locator('button:has-text("📝")').first();

  // (1) quick reply chips visible
  const s1 = join(OUT_DIR, "7-quick-replies-visible.png");
  await page.screenshot({ path: s1, fullPage: false });

  // (2) click first quick reply chip + input filled and focused
  const firstChipText = ((await quickReplyButtons.first().textContent()) || "").trim();
  await quickReplyButtons.first().click({ timeout: 2500 });
  await page.waitForTimeout(250);
  await textarea.click({ timeout: 2500 });
  await page.waitForTimeout(150);
  const inputValueAfterChip = await textarea.inputValue();
  const inputFocused = await page.evaluate(() => {
    const ta = document.querySelector('div[role="form"] textarea');
    return ta ? document.activeElement === ta : false;
  });
  const s2 = join(OUT_DIR, "8-quick-reply-filled-focused.png");
  await page.screenshot({ path: s2, fullPage: false });

  // (3) enable note mode and capture indicator position
  await noteBtn.click({ timeout: 2500 });
  await page.waitForTimeout(350);
  const noteIndicatorVisible = await page
    .locator('div:has-text("📝")')
    .filter({ hasText: /team/i })
    .first()
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  const s3 = join(OUT_DIR, "9-note-mode-indicator.png");
  await page.screenshot({ path: s3, fullPage: false });

  // (4) with input empty send gray
  await textarea.fill("");
  await page.waitForTimeout(250);
  const sendDisabledEmpty = await sendBtn.isDisabled();
  const s4 = join(OUT_DIR, "10-send-gray-empty.png");
  await page.screenshot({ path: s4, fullPage: false });

  // (5) type text and send button amber gradient
  await textarea.fill("composer state check");
  await page.waitForTimeout(250);
  const sendEnabledTyped = await sendBtn.isEnabled();
  const s5 = join(OUT_DIR, "11-send-amber-typed.png");
  await page.screenshot({ path: s5, fullPage: false });

  console.log(JSON.stringify({
    clickedWith,
    firstChipText,
    inputValueAfterChip,
    inputFocused,
    noteIndicatorVisible,
    sendDisabledEmpty,
    sendEnabledTyped,
    screenshots: [s1, s2, s3, s4, s5],
    finalUrl: page.url(),
  }, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

