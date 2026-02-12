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
    const clicked = await el.click({ timeout: 2000 }).then(() => true).catch(() => false);
    if (clicked) {
      await page.waitForTimeout(1000);
      return true;
    }
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  await loginAndSeedCookie(context);
  await page.goto(`${BASE}/portal/inbox`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(1500);
  await openConversation(page);

  const text = `Agent test ${Date.now()}`;
  const composer = page.locator('div[role="form"] textarea').first();
  const sendBtn = page.locator('div[role="form"] button').last();

  await composer.fill(text);
  await page.waitForTimeout(350);

  // Verify send button is enabled/amber state by disabled attribute false.
  const canSend = await sendBtn.isEnabled().catch(() => false);
  if (!canSend) throw new Error("Send button did not become active");

  await sendBtn.click({ timeout: 2500 });
  await page.waitForTimeout(1200);

  // Confirm message appended in message list by unique text presence.
  const appeared = await page.locator(`text=${text}`).first().isVisible({ timeout: 6000 }).catch(() => false);
  if (!appeared) throw new Error("Sent message text not visible in message list");

  const path = join(OUT_DIR, "6-message-sent-proof.png");
  await page.screenshot({ path, fullPage: false });

  console.log(JSON.stringify({ screenshot: path, messageText: text, appended: appeared, url: page.url() }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

