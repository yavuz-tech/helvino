/**
 * Captures portal sidebar screenshot. Run: pnpm exec playwright test scripts/portal-sidebar-screenshot.spec.ts --project=chromium
 */
import { test } from "@playwright/test";
import * as path from "path";

const BASE = "http://localhost:3000";
const API = "http://localhost:4000";

test("capture portal sidebar", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // Login via API
  const loginRes = await fetch(`${API}/portal/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@test.com", password: "Test1234!" }),
  });
  if (!loginRes.ok) throw new Error("Login failed");

  const cookies = loginRes.headers.get("set-cookie");
  if (cookies) {
    const match = cookies.match(/helvino_portal_sid=([^;]+)/);
    if (match) {
      await context.addCookies([
        { name: "helvino_portal_sid", value: match[1], domain: "localhost", path: "/" },
      ]);
    }
  }

  const page = await context.newPage();
  await page.goto(`${BASE}/portal`, { waitUntil: "networkidle" });
  const url = page.url();

  if (url.includes("/login")) {
    test.skip(true, "Redirected to login - no valid session");
    return;
  }

  if (url.includes("security-onboarding")) {
    const laterBtn = page.getByRole("button", { name: /later|skip|daha sonra|ahora no/i });
    if (await laterBtn.isVisible()) {
      await laterBtn.click();
      await page.waitForURL(/\/portal$/, { timeout: 5000 }).catch(() => {});
    }
  }

  await page.goto(`${BASE}/portal`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  const outDir = path.join(process.cwd(), "portal-sidebar-screenshot");
  const screenshotPath = path.join(outDir, "portal-sidebar.png");
  await page.screenshot({ path: screenshotPath });
  console.log("Screenshot saved:", screenshotPath);
});
