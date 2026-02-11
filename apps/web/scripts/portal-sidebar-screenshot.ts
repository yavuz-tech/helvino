/**
 * One-off script to capture portal sidebar screenshot.
 * Run: pnpm exec tsx apps/web/scripts/portal-sidebar-screenshot.ts
 */
import { chromium } from "@playwright/test";
import * as path from "path";

const BASE = "http://localhost:3000";
const API = "http://localhost:4000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // 1. Login via API to get session cookie
  const loginRes = await fetch(`${API}/portal/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@test.com", password: "Test1234!" }),
  });
  if (!loginRes.ok) {
    console.error("Login failed:", await loginRes.text());
    await browser.close();
    process.exit(1);
  }

  const cookies = loginRes.headers.get("set-cookie");
  if (cookies) {
    const match = cookies.match(/helvino_portal_sid=([^;]+)/);
    if (match) {
      await context.addCookies([
        {
          name: "helvino_portal_sid",
          value: match[1],
          domain: "localhost",
          path: "/",
        },
      ]);
    }
  }

  const page = await context.newPage();

  // 2. Navigate to portal (may redirect to security-onboarding)
  await page.goto(`${BASE}/portal`, { waitUntil: "networkidle" });
  const url = page.url();

  if (url.includes("/login")) {
    console.error("Redirected to login - no valid session");
    await browser.close();
    process.exit(1);
  }

  // If security-onboarding, click "later" to reach portal
  if (url.includes("security-onboarding")) {
    const laterBtn = page.getByRole("button", { name: /later|skip|daha sonra/i });
    if (await laterBtn.isVisible()) {
      await laterBtn.click();
      await page.waitForURL(/\/portal$/, { timeout: 5000 }).catch(() => {});
    }
  }

  await page.goto(`${BASE}/portal`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  const outDir = path.join(process.cwd(), "portal-sidebar-screenshot");
  const screenshotPath = path.join(outDir, "portal-sidebar.png");
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log("Screenshot saved:", screenshotPath);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
