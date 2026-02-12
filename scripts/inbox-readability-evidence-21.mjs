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

  await loginAndSeedCookie(context);
  await page.goto(`${BASE}/portal/inbox`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(1700);
  const clickedWith = await openConversation(page);

  // 1) Toolbar evidence
  await page.evaluate(() => {
    const header = document.querySelector('div[style*="border-bottom"]');
    if (header) header.scrollIntoView({ behavior: "instant", block: "start" });
  });
  await page.waitForTimeout(300);
  const s21 = join(OUT_DIR, "21-toolbar-buttons-size.png");
  await page.screenshot({ path: s21, fullPage: false });
  const toolbarButtonOuterHTML = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent || "").includes("🤖"));
    return btn ? btn.outerHTML : null;
  });

  // 2) Right panel details label/value sizes
  const infoBtn = page.locator('button:has-text("ℹ️")').first();
  if (await infoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await infoBtn.click({ timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  // Ensure details tab active (first tab)
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button[style*="font-size: 10px"][style*="border-bottom"]'));
    if (tabs[0]) tabs[0].click();
  });
  await page.waitForTimeout(350);
  const s22 = join(OUT_DIR, "22-right-panel-details-readability.png");
  await page.screenshot({ path: s22, fullPage: false });
  const detailsTextEvidence = await page.evaluate(() => {
    // Scope to right panel details section: fields use tiny uppercase labels and value lines.
    const allSpans = Array.from(document.querySelectorAll("span"));
    const labels = allSpans.filter((el) => {
      const style = el.getAttribute("style") || "";
      const st = window.getComputedStyle(el);
      return (
        style.includes("letter-spacing") &&
        (st.fontSize === "8px" || st.fontSize === "10px") &&
        (el.textContent || "").trim().length > 0
      );
    });
    const allDivs = Array.from(document.querySelectorAll("div"));
    const values = allDivs.filter((el) => {
      const style = el.getAttribute("style") || "";
      const st = window.getComputedStyle(el);
      return (
        style.includes("white-space: pre-wrap") &&
        (st.fontSize === "11px" || st.fontSize === "13px") &&
        (el.textContent || "").trim().length > 0
      );
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

  // 3) Message bubble content size evidence
  await page.evaluate(() => {
    const msgArea = Array.from(document.querySelectorAll("div")).find((d) => (d.getAttribute("style") || "").includes("overflow-y-auto") && (d.getAttribute("style") || "").includes("#FFFBF5"));
    if (msgArea) msgArea.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(300);
  const s23 = join(OUT_DIR, "23-message-bubble-readability.png");
  await page.screenshot({ path: s23, fullPage: false });
  const messagePEvidence = await page.evaluate(() => {
    // Prefer actual chat bubble content paragraphs (inline style with pre-wrap).
    const p = Array.from(document.querySelectorAll("p")).find((el) => {
      const style = el.getAttribute("style") || "";
      const st = window.getComputedStyle(el);
      return style.includes("white-space: pre-wrap") && (st.fontSize === "13px" || st.fontSize === "14px");
    }) || null;
    return {
      outerHTML: p ? p.outerHTML : null,
      fontSize: p ? window.getComputedStyle(p).fontSize : null,
    };
  });

  // 4) Quick replies + emoji picker larger evidence
  await page.evaluate(() => {
    const form = document.querySelector('div[role="form"]');
    if (form) form.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(300);
  const emojiBtn = page.locator('button:has-text("😊")').first();
  if (await emojiBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
    await emojiBtn.click({ timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(250);
  }
  const s24 = join(OUT_DIR, "24-quick-replies-emoji-picker.png");
  await page.screenshot({ path: s24, fullPage: false });
  const quickEmojiEvidence = await page.evaluate(() => {
    const quick = Array.from(document.querySelectorAll("button")).find((b) => (b.getAttribute("style") || "").includes("border-radius: 16px"));
    const emoji = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent || "").trim() === "😊");
    return {
      quickReplyOuterHTML: quick ? quick.outerHTML : null,
      quickReplyFontSize: quick ? window.getComputedStyle(quick).fontSize : null,
      emojiOuterHTML: emoji ? emoji.outerHTML : null,
      emojiWidth: emoji ? window.getComputedStyle(emoji).width : null,
      emojiHeight: emoji ? window.getComputedStyle(emoji).height : null,
      emojiFontSize: emoji ? window.getComputedStyle(emoji).fontSize : null,
    };
  });

  console.log(JSON.stringify({
    finalUrl: page.url(),
    clickedWith,
    screenshots: [s21, s22, s23, s24],
    toolbarButtonOuterHTML,
    detailsTextEvidence,
    messagePEvidence,
    quickEmojiEvidence,
  }, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

