/**
 * Browser automation: open portal/inbox, load conversation, capture screenshot.
 * Run: node scripts/inbox-screenshot.mjs
 */
import { chromium } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3000";
const API = "http://localhost:4000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // Login via API
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
        { name: "helvino_portal_sid", value: match[1], domain: "localhost", path: "/" },
      ]);
    }
  }

  const page = await context.newPage();
  const errors = [];

  page.on("pageerror", (e) => errors.push({ type: "pageerror", message: e.message }));
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[object Event]") || msg.type() === "error") {
      errors.push({ type: "console", message: text });
    }
  });

  try {
    await page.goto(`${BASE}/portal/inbox`, { waitUntil: "domcontentloaded", timeout: 20000 });
  } catch (e) {
    console.error("Navigation failed:", e.message);
    await browser.close();
    process.exit(1);
  }

  const url = page.url();
  if (url.includes("/login")) {
    console.error("Redirected to login - no valid session");
    await browser.close();
    process.exit(1);
  }

  // Wait for inbox to load
  await page.waitForTimeout(2500);

  // Multi-strategy click to open a visible conversation in the left list.
  let clickedStrategy = "none";
  const clickStrategies = [
    {
      name: "text-user",
      locator: page
        .locator("button, a, div")
        .filter({ hasText: /^user$/i })
        .first(),
    },
    {
      name: "unassigned-block",
      locator: page
        .locator("button, a, div")
        .filter({ hasText: /UNASSIGNED|ATANMAMI[SŞ]/i })
        .first(),
    },
    {
      name: "role-button-row",
      locator: page
        .locator('[role="button"], [role="row"], [data-conversation-id], [data-testid="conversation-item"]')
        .first(),
    },
    {
      name: "first-clickable-list-item",
      locator: page
        .locator("main div.cursor-pointer, aside div.cursor-pointer, [class*='conversation'], a[href*='?c=']")
        .first(),
    },
  ];

  for (const strategy of clickStrategies) {
    const visible = await strategy.locator.isVisible({ timeout: 1500 }).catch(() => false);
    if (!visible) continue;
    const clicked = await strategy.locator.click({ timeout: 2000 }).then(() => true).catch(() => false);
    if (clicked) {
      clickedStrategy = strategy.name;
      await page.waitForTimeout(1800);
      break;
    }
  }

  const outDir = join(__dirname, "..", "inbox-screenshot");
  const screenshotPath = join(outDir, "inbox-messages-center-panel.png");
  await page.screenshot({ path: screenshotPath, fullPage: false });

  console.log("Page loaded:", url);
  console.log("Conversation click strategy:", clickedStrategy);
  console.log("Screenshot saved:", screenshotPath);
  if (errors.length) console.log("Errors:", JSON.stringify(errors, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
