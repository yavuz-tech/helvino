#!/usr/bin/env node
/**
 * Founding Member Race Condition Test
 * 100 concurrent POST /api/checkout requests via Promise.all
 */
const BASE = process.env.BASE_URL || "http://localhost:4000";
const PORTAL_EMAIL = process.env.PORTAL_EMAIL || "owner@demo.helvion.io";
const PORTAL_PASSWORD = process.env.PORTAL_PASSWORD || "demo_owner_2026";
const CONCURRENCY = 100;

async function run() {
  const results = { total: CONCURRENCY, success: 0, fail4xx: 0, fail5xx: 0, errors: 0, responses: [] };

  // 1. Login to get cookie
  let cookie = "";
  try {
    const loginRes = await fetch(`${BASE}/portal/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: PORTAL_EMAIL, password: PORTAL_PASSWORD }),
    });
    const setCookie = loginRes.headers.getSetCookie?.() || [];
    cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
    if (!cookie) {
      // Fallback: try raw header
      const raw = loginRes.headers.get("set-cookie") || "";
      cookie = raw.split(",").map((c) => c.trim().split(";")[0]).join("; ");
    }
    console.log(`[login] status=${loginRes.status} cookie=${cookie ? "YES" : "NO"}`);
  } catch (e) {
    console.error("[login] failed:", e.message);
  }

  // 2. Fire 100 concurrent checkout requests
  console.log(`[race] Firing ${CONCURRENCY} concurrent POST /api/checkout ...`);
  const start = Date.now();

  const promises = Array.from({ length: CONCURRENCY }, (_, i) =>
    fetch(`${BASE}/api/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        "x-test-vu": String(i),
      },
      body: JSON.stringify({ planKey: "starter", period: "yearly" }),
    })
      .then((r) => {
        if (r.status >= 200 && r.status < 300) results.success++;
        else if (r.status >= 400 && r.status < 500) results.fail4xx++;
        else if (r.status >= 500) results.fail5xx++;
        return { vu: i, status: r.status };
      })
      .catch((e) => {
        results.errors++;
        return { vu: i, status: 0, error: e.message };
      })
  );

  const responses = await Promise.all(promises);
  results.durationMs = Date.now() - start;
  results.responses = responses;

  // 3. Check founding member count
  try {
    const statusRes = await fetch(`${BASE}/api/founding-member-status`);
    const data = await statusRes.json();
    results.foundingMemberCount = data.count ?? data.foundingMemberCount ?? -1;
    results.foundingMemberLimit = data.limit ?? 200;
    results.raceCondition = results.foundingMemberCount > 200;
    if (results.raceCondition) {
      console.error(`[RACE CONDITION] count=${results.foundingMemberCount} > limit=200`);
    } else {
      console.log(`[OK] founding member count=${results.foundingMemberCount} / 200`);
    }
  } catch (e) {
    console.error("[founding-status] failed:", e.message);
    results.foundingMemberCount = -1;
    results.raceCondition = "unknown";
  }

  // 4. Write result
  const outPath = process.env.OUT_PATH || "results/D-race-condition.json";
  const { writeFileSync, mkdirSync } = require("fs");
  const { dirname } = require("path");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`[done] results written to ${outPath}`);
  console.log(`  duration: ${results.durationMs}ms`);
  console.log(`  success(2xx): ${results.success}  4xx: ${results.fail4xx}  5xx: ${results.fail5xx}  errors: ${results.errors}`);
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
