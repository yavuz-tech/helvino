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
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();
  const errors = [];

  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  await loginAndSeedCookie(context);
  await page.goto(`${BASE}/portal/inbox`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(1700);

  const clickedWith = await openConversation(page);

  // Open right panel using ℹ️ toolbar button
  const infoBtn = page.locator('button:has-text("ℹ️")').first();
  const infoVisible = await infoBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (!infoVisible) throw new Error(`Info button not visible (clickedWith=${clickedWith})`);
  await infoBtn.click({ timeout: 3000 });
  await page.waitForTimeout(500);

  // (1) right panel visible after info click
  const s1 = join(OUT_DIR, "12-info-click-right-panel-visible.png");
  await page.screenshot({ path: s1, fullPage: false });

  // (2) header with avatar/name/status/message/note counts
  await page.evaluate(() => {
    const rightPanel = Array.from(document.querySelectorAll("div")).find((el) => {
      const style = (el.getAttribute("style") || "").toLowerCase();
      return style.includes("border-left") || style.includes("bordercolor");
    });
    if (rightPanel) rightPanel.scrollIntoView({ behavior: "instant", block: "start" });
  });
  await page.waitForTimeout(300);
  const s2 = join(OUT_DIR, "13-right-panel-header-stats.png");
  await page.screenshot({ path: s2, fullPage: false });

  // Tab buttons: details / notes (style-based selector, locale-agnostic)
  const rightPanelTabButtons = page.locator('button[style*="font-size: 10px"][style*="border-bottom"]');
  const tabCount = await rightPanelTabButtons.count();
  if (tabCount >= 2) {
    await rightPanelTabButtons.nth(0).click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(250);
  }
  const detailsActiveOuterHTML = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[style*="font-size: 10px"][style*="border-bottom"]'));
    if (btns.length < 2) return null;
    return {
      firstTab: btns[0].outerHTML,
      secondTab: btns[1].outerHTML,
      activeTab: btns.find((b) => (b.getAttribute("style") || "").includes("2px solid #F59E0B"))?.outerHTML || null,
    };
  });

  // Switch to notes and capture active-tab screenshot + outerHTML (by index 1)
  if (tabCount >= 2) {
    // Force click second tab via DOM to avoid hover overlays intercepting pointer events.
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[style*="font-size: 10px"][style*="border-bottom"]'));
      if (btns.length >= 2) btns[1].click();
    });
    await page.waitForTimeout(500);
  }
  const notesActiveOuterHTML = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[style*="font-size: 10px"][style*="border-bottom"]'));
    if (btns.length < 2) return null;
    return {
      firstTab: btns[0].outerHTML,
      secondTab: btns[1].outerHTML,
      activeTab: btns.find((b) => (b.getAttribute("style") || "").includes("2px solid #F59E0B"))?.outerHTML || null,
    };
  });

  // (3) tab switching with active amber style (notes active)
  const s3 = join(OUT_DIR, "14-tabs-switch-notes-active-amber.png");
  await page.screenshot({ path: s3, fullPage: false });

  // (6) notes tab content state (locked/unlocked)
  // Stay on notes tab and capture content area
  const notesState = await page.evaluate(() => {
    const text = document.body.innerText.toLowerCase();
    if (text.includes("unlock") || text.includes("upgrade") || text.includes("starter") || text.includes("pro")) return "locked_or_upgrade_prompt_visible";
    return "unlocked_or_no_lock_prompt";
  });
  const s4 = join(OUT_DIR, "15-notes-tab-content-state.png");
  await page.screenshot({ path: s4, fullPage: false });

  console.log(JSON.stringify({
    finalUrl: page.url(),
    clickedWith,
    notesState,
    screenshots: [s1, s2, s3, s4],
    tabOuterHTML: {
      detailsActiveOuterHTML,
      notesActiveOuterHTML,
    },
    errors,
  }, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

