import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const API = "http://localhost:4000";

async function loginAndSeedCookie(context) {
  const loginRes = await fetch(`${API}/portal/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@test.com", password: "Test1234!" }),
  });
  const cookies = loginRes.headers.get("set-cookie");
  const match = cookies?.match(/helvino_portal_sid=([^;]+)/);
  if (!match) throw new Error("Session cookie missing");
  await context.addCookies([{ name: "helvino_portal_sid", value: match[1], domain: "localhost", path: "/" }]);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();
  await loginAndSeedCookie(context);
  await page.goto(`${BASE}/portal/inbox`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(1500);

  const row = page.locator('div[role="button"].cursor-pointer.mx-2.my-1').first();
  if (await row.isVisible().catch(() => false)) {
    await row.click().catch(() => {});
    await page.waitForTimeout(900);
  }

  const emojiBtn = page.locator('button:has-text("😊")').first();
  await emojiBtn.click({ timeout: 3000 });
  await page.waitForTimeout(250);

  const data = await page.evaluate(() => {
    const picker = Array.from(document.querySelectorAll("div")).find((d) => {
      const st = d.getAttribute("style") || "";
      return st.includes("gridTemplateColumns: repeat(6, 1fr)") || st.includes("width: 220px");
    }) || null;
    const item = picker?.querySelector("button") || null;
    if (!picker || !item) return null;
    const itemStyle = window.getComputedStyle(item);
    const pickerStyle = window.getComputedStyle(picker);
    return {
      emojiItemOuterHTML: item.outerHTML,
      emojiItemComputed: {
        width: itemStyle.width,
        height: itemStyle.height,
        fontSize: itemStyle.fontSize,
      },
      pickerComputed: {
        width: pickerStyle.width,
      },
    };
  });

  console.log(JSON.stringify(data, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

