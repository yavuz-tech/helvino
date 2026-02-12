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

  // Click locked AI suggest button 🤖
  const aiBtn = page.locator('button:has-text("🤖")').first();
  const aiBtnVisible = await aiBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (!aiBtnVisible) throw new Error(`AI button not visible (clickedWith=${clickedWith})`);
  await aiBtn.click({ timeout: 3000 });
  await page.waitForTimeout(450);

  const modalVisible = await page.locator("text=STARTER").first().isVisible({ timeout: 3000 }).catch(() => false);

  const s1 = join(OUT_DIR, "16-ai-locked-click-modal-open.png");
  await page.screenshot({ path: s1, fullPage: false });

  // Plan cards visible
  const planVisible = await page.evaluate(() => ({
    starter: !!Array.from(document.querySelectorAll("span,div,p")).find((n) => (n.textContent || "").trim() === "STARTER"),
    pro: !!Array.from(document.querySelectorAll("span,div,p")).find((n) => (n.textContent || "").trim() === "PRO"),
    enterprise: !!Array.from(document.querySelectorAll("span,div,p")).find((n) => (n.textContent || "").trim() === "ENTERPRISE"),
  }));
  const s2 = join(OUT_DIR, "17-modal-three-plan-cards.png");
  await page.screenshot({ path: s2, fullPage: false });

  // PRO highlighted card + minimum-plan arrow text
  const proEvidence = await page.evaluate(() => {
    const viewPlansBtn = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent || "").includes("View Plans"));
    const modalRoot = viewPlansBtn?.closest("div[style]")?.parentElement || viewPlansBtn?.closest("div[style]") || null;
    if (!modalRoot) return { outerHTML: null, minimumArrowVisible: false, border: null, background: null };

    // Select card blocks by inline border style in modal plan list.
    const cards = Array.from(modalRoot.querySelectorAll("div[style]")).filter((d) => {
      const style = d.getAttribute("style") || "";
      const txt = (d.textContent || "").replace(/\s+/g, " ").trim();
      return style.includes("border-radius: 12px") && txt.includes("/") && (txt.includes("STARTER") || txt.includes("PRO") || txt.includes("ENTERPRISE"));
    });
    const proCard = cards.find((d) => (d.textContent || "").includes("PRO")) || null;
    if (!proCard) return { outerHTML: null, minimumArrowVisible: false, border: null, background: null };
    const st = window.getComputedStyle(proCard);
    const minimumArrowVisible = (proCard.textContent || "").includes("←");
    return {
      outerHTML: proCard.outerHTML,
      minimumArrowVisible,
      border: st.border,
      background: st.background,
    };
  });
  const s3 = join(OUT_DIR, "18-pro-highlight-min-plan-arrow.png");
  await page.screenshot({ path: s3, fullPage: false });

  // View Plans button amber gradient computed style
  const viewPlansEvidence = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => {
      const t = (b.textContent || "").trim();
      return t.includes("View Plans") || t.includes("Plans") || t.includes("→");
    });
    if (!btn) return { outerHTML: null, background: null, backgroundImage: null };
    const st = window.getComputedStyle(btn);
    return {
      outerHTML: btn.outerHTML,
      background: st.background,
      backgroundImage: st.backgroundImage,
    };
  });
  const s4 = join(OUT_DIR, "19-view-plans-amber-gradient.png");
  await page.screenshot({ path: s4, fullPage: false });

  // Close modal: prefer "Not now", else click modal's last button, else backdrop.
  const notNowBtn = page.locator("button", { hasText: /Not now|Not Now|Şimdi değil|Ahora no/i }).first();
  const notNowVisible = await notNowBtn.isVisible({ timeout: 1200 }).catch(() => false);
  if (notNowVisible) {
    await notNowBtn.click({ timeout: 2500 }).catch(() => {});
  } else {
    const closedByLastButton = await page.evaluate(() => {
      const viewPlans = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent || "").includes("View Plans"));
      if (!viewPlans) return false;
      const modal = viewPlans.closest("div[style]")?.parentElement || viewPlans.closest("div[style]");
      if (!modal) return false;
      const btns = modal.querySelectorAll("button");
      if (!btns.length) return false;
      (btns[btns.length - 1]).click();
      return true;
    }).catch(() => false);
    if (!closedByLastButton) {
      await page.mouse.click(20, 20);
    }
  }
  await page.waitForTimeout(400);
  const modalGone = !(await page.locator("button", { hasText: /View Plans/i }).first().isVisible({ timeout: 1500 }).catch(() => false));
  const s5 = join(OUT_DIR, "20-modal-closed.png");
  await page.screenshot({ path: s5, fullPage: false });

  console.log(JSON.stringify({
    finalUrl: page.url(),
    clickedWith,
    checks: {
      modalVisibleAfterAiClick: modalVisible,
      threePlansVisible: planVisible,
      proMinimumArrowVisible: proEvidence.minimumArrowVisible,
      modalGoneAfterClose: modalGone,
    },
    screenshots: [s1, s2, s3, s4, s5],
    proCardEvidence: proEvidence,
    viewPlansEvidence,
    errors,
  }, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

