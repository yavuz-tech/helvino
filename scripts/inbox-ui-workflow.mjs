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
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${await loginRes.text()}`);
  }
  const cookies = loginRes.headers.get("set-cookie");
  const match = cookies?.match(/helvino_portal_sid=([^;]+)/);
  if (!match) throw new Error("Session cookie missing from login response");
  await context.addCookies([
    { name: "helvino_portal_sid", value: match[1], domain: "localhost", path: "/" },
  ]);
}

async function openConversation(page) {
  const clickSelectors = [
    `div[role="button"].cursor-pointer.mx-2.my-1`,
    `div[role="button"].cursor-pointer`,
    `div[role="button"]:has(div.text-\\[13px\\])`,
    `button:has-text("user")`,
    `[data-conversation-id]`,
    `[data-testid="conversation-item"]`,
  ];
  for (const sel of clickSelectors) {
    const el = page.locator(sel).first();
    const ok = await el.isVisible({ timeout: 1200 }).catch(() => false);
    if (!ok) continue;
    const clicked = await el.click({ timeout: 2000 }).then(() => true).catch(() => false);
    if (clicked) {
      await page.waitForTimeout(1200);
      return sel;
    }
  }

  // Last fallback: click first item in left panel by coordinates.
  const box = await page.locator("aside").boundingBox().catch(() => null);
  if (box) {
    await page.mouse.click(box.x + box.width - 20, box.y + 220);
    await page.waitForTimeout(1200);
    return "mouse-fallback-left-panel";
  }
  return "none";
}

async function ensureComposerVisible(page) {
  await page.evaluate(() => {
    const form = document.querySelector('div[role="form"]');
    if (form) form.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(400);
}

async function clickFirstQuickReply(page) {
  const clicked = await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('button[style*="border-radius: 16px"]'))
      .filter((b) => (b.textContent || "").trim().length > 0);
    if (!chips.length) return false;
    chips[0].click();
    return true;
  });
  await page.waitForTimeout(500);
  return clicked;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  const errors = [];

  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  await loginAndSeedCookie(context);
  await page.goto(`${BASE}/portal/inbox`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(1800);

  const clickedWith = await openConversation(page);
  // Ensure center chat really opened (toolbar with 🤖 should be visible when a conversation is selected)
  const toolbarVisible = await page.locator('button:has-text("🤖")').first().isVisible({ timeout: 2500 }).catch(() => false);
  await ensureComposerVisible(page);

  const shot1 = join(OUT_DIR, "1-toolbar-center-panel.png");
  await page.screenshot({ path: shot1, fullPage: false });

  const shot2 = join(OUT_DIR, "2-composer-quick-replies.png");
  await page.screenshot({ path: shot2, fullPage: false });

  // Emoji popup
  const emojiBtn = page.locator('button:has-text("😊")').first();
  const emojiVisible = await emojiBtn.isVisible({ timeout: 2500 }).catch(() => false);
  if (emojiVisible) {
    await emojiBtn.click({ timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  const shot3 = join(OUT_DIR, "3-emoji-popup.png");
  await page.screenshot({ path: shot3, fullPage: false });

  // Quick reply fills input
  const quickReplyClicked = await clickFirstQuickReply(page);
  const shot4 = join(OUT_DIR, "4-first-quick-reply-filled.png");
  await page.screenshot({ path: shot4, fullPage: false });

  // Type composer text so send becomes active amber
  const textarea = page.locator("textarea").first();
  const taVisible = await textarea.isVisible({ timeout: 2500 }).catch(() => false);
  if (taVisible) {
    await textarea.fill("Testing active send button state");
    await page.waitForTimeout(350);
  }
  const shot5 = join(OUT_DIR, "5-send-active-amber.png");
  await page.screenshot({ path: shot5, fullPage: false });

  const finalUrl = page.url();
  await browser.close();

  console.log(JSON.stringify({
    finalUrl,
    clickedWith,
    toolbarVisible,
    quickReplyClicked,
    screenshots: [shot1, shot2, shot3, shot4, shot5],
    errors,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

