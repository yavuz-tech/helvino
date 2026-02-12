import { chromium } from "@playwright/test";
import { join } from "path";

const BASE = "http://localhost:3000";
const API = "http://localhost:4000";
const OUT_DIR = "/Users/yavuz/Desktop/helvino/inbox-screenshot";
const TRIGGER_TEXT = "AI debug test";

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
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();

  await loginAndSeedCookie(context);
  await page.goto(`${BASE}/portal/inbox`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(1700);
  const clickedWith = await openConversation(page);

  // Ensure composer visible
  await page.evaluate(() => {
    const form = document.querySelector('div[role="form"]');
    if (form) form.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(300);

  const textarea = page.locator('div[role="form"] textarea').first();
  const sendBtn = page.locator('div[role="form"] button').last();

  await textarea.fill(TRIGGER_TEXT);
  await page.waitForTimeout(250);
  const canSend = await sendBtn.isEnabled().catch(() => false);
  if (!canSend) throw new Error("Send button not enabled for trigger text");
  await sendBtn.click({ timeout: 3000 });
  await page.waitForTimeout(900);

  const sentShot = join(OUT_DIR, "29-message-sent-trigger.png");
  await page.screenshot({ path: sentShot, fullPage: false });

  // Wait up to 20s for AI response marker/bubble.
  let aiFound = false;
  for (let i = 0; i < 20; i++) {
    aiFound = await page.evaluate(() => {
      const text = (document.body.innerText || "");
      if (text.includes("🤖 AI")) return true;
      // Also detect blue assistant avatar/badge in chat area.
      return !!Array.from(document.querySelectorAll("div,span"))
        .find((el) => (el.textContent || "").includes("🤖 AI") || (el.textContent || "").includes("AI Assistant"));
    });
    if (aiFound) break;
    await page.waitForTimeout(1000);
  }

  const aiShot = join(OUT_DIR, "29-ai-response-or-error.png");
  await page.screenshot({ path: aiShot, fullPage: false });

  const result = await page.evaluate(() => {
    // Extract tight AI badge + bubble snippet.
    const aiBadge = Array.from(document.querySelectorAll("span"))
      .find((el) => (el.textContent || "").trim().includes("🤖 AI"));
    let aiBubbleOuterHTML = null;
    if (aiBadge) {
      const badgeWrap = aiBadge.closest("div");
      // Find nearest sibling/ancestor bubble container with blue border/background.
      const candidate = badgeWrap?.parentElement?.querySelector('div[style*="border: 1px solid rgb(191, 219, 254)"]')
        || badgeWrap?.parentElement?.querySelector('div[style*="background: rgb(239, 246, 255)"]');
      aiBubbleOuterHTML = candidate ? candidate.outerHTML : aiBadge.outerHTML;
    }

    // Fallback: capture toast/error text exactly
    const possibleErrors = [];
    const toast = Array.from(document.querySelectorAll("div,span,p")).find((el) => {
      const t = (el.textContent || "").trim();
      return t.length > 0 && (
        t.includes("error") ||
        t.includes("Error") ||
        t.includes("failed") ||
        t.includes("Failed") ||
        t.includes("quota") ||
        t.includes("upgrade") ||
        t.includes("Too many requests") ||
        t.includes("network")
      );
    });
    if (toast) possibleErrors.push((toast.textContent || "").trim());

    return {
      aiBubbleOuterHTML,
      visibleErrorText: possibleErrors[0] || null,
    };
  });

  console.log(JSON.stringify({
    finalUrl: page.url(),
    clickedWith,
    triggerText: TRIGGER_TEXT,
    aiFound,
    screenshots: [sentShot, aiShot],
    ...result,
  }, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

