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
  const context = await browser.newContext({ viewport: { width: 1680, height: 980 } });
  const page = await context.newPage();

  await loginAndSeedCookie(context);
  await page.goto(`${BASE}/portal/inbox`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(1800);
  const clickedWith = await openConversation(page);

  // (1) Toolbar
  await page.evaluate(() => {
    const header = document.querySelector('div[style*="border-bottom"]');
    if (header) header.scrollIntoView({ behavior: "instant", block: "start" });
  });
  await page.waitForTimeout(250);
  const s25 = join(OUT_DIR, "25-toolbar-size-proof.png");
  await page.screenshot({ path: s25, fullPage: false });
  const toolbarButton = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent || "").includes("🤖"));
    if (!btn) return null;
    const st = window.getComputedStyle(btn);
    return {
      outerHTML: btn.outerHTML,
      computed: { width: st.width, height: st.height, fontSize: st.fontSize },
    };
  });

  // (2) Right panel details
  const infoBtn = page.locator('button:has-text("ℹ️")').first();
  if (await infoBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
    await infoBtn.click({ timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button[style*="font-size: 10px"][style*="border-bottom"]'));
    if (tabs[0]) tabs[0].click();
  });
  await page.waitForTimeout(300);
  const s26 = join(OUT_DIR, "26-right-panel-readability-proof.png");
  await page.screenshot({ path: s26, fullPage: false });
  const rightPanelText = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll("span")).filter((el) => {
      const style = el.getAttribute("style") || "";
      return style.includes("letter-spacing");
    });
    const values = Array.from(document.querySelectorAll("div")).filter((el) => {
      const style = el.getAttribute("style") || "";
      return style.includes("white-space: pre-wrap");
    });
    const label = labels[0] || null;
    const value = values[0] || null;
    return {
      labelOuterHTML: label ? label.outerHTML : null,
      labelFontSize: label ? window.getComputedStyle(label).fontSize : null,
      valueOuterHTML: value ? value.outerHTML : null,
      valueFontSize: value ? window.getComputedStyle(value).fontSize : null,
    };
  });

  // (3) Message bubble text size
  await page.evaluate(() => {
    const msgArea = Array.from(document.querySelectorAll("div")).find((d) => {
      const st = d.getAttribute("style") || "";
      return st.includes("overflow-y-auto") && st.includes("#FFFBF5");
    });
    if (msgArea) msgArea.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(250);
  const s27 = join(OUT_DIR, "27-message-bubble-size-proof.png");
  await page.screenshot({ path: s27, fullPage: false });
  const bubbleText = await page.evaluate(() => {
    const p = Array.from(document.querySelectorAll("p")).find((el) => {
      const style = el.getAttribute("style") || "";
      return style.includes("white-space: pre-wrap");
    }) || null;
    return {
      outerHTML: p ? p.outerHTML : null,
      fontSize: p ? window.getComputedStyle(p).fontSize : null,
    };
  });

  // Composer quick reply chip and send button quick checks
  await page.evaluate(() => {
    const form = document.querySelector('div[role="form"]');
    if (form) form.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(250);
  const composerChecks = await page.evaluate(() => {
    const quick = Array.from(document.querySelectorAll("button")).find((b) => {
      const s = b.getAttribute("style") || "";
      return s.includes("border-radius: 18px") || s.includes("border-radius: 16px");
    }) || null;
    const sendBtn = Array.from(document.querySelectorAll('div[role="form"] button')).pop() || null;
    const quickSt = quick ? window.getComputedStyle(quick) : null;
    const sendSt = sendBtn ? window.getComputedStyle(sendBtn) : null;
    return {
      quickReplyOuterHTML: quick ? quick.outerHTML : null,
      quickReplyFontSize: quickSt ? quickSt.fontSize : null,
      sendButtonOuterHTML: sendBtn ? sendBtn.outerHTML : null,
      sendButtonWidth: sendSt ? sendSt.width : null,
      sendButtonHeight: sendSt ? sendSt.height : null,
    };
  });

  // (4) Wide screenshot for overall scale
  const s28 = join(OUT_DIR, "28-wide-overall-scale.png");
  await page.screenshot({ path: s28, fullPage: false });

  console.log(JSON.stringify({
    finalUrl: page.url(),
    clickedWith,
    screenshots: [s25, s26, s27, s28],
    toolbarButton,
    rightPanelText,
    bubbleText,
    composerChecks,
  }, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

