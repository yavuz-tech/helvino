import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";
const ORG_KEY = __ENV.ORG_KEY || "demo";
const PORTAL_EMAIL = __ENV.PORTAL_EMAIL || "owner@demo.helvion.io";
const PORTAL_PASSWORD = __ENV.PORTAL_PASSWORD || "demo_owner_2026";
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || "admin-test@helvion.io";
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || "AdminTest_2026!";

export const options = {
  stages: [
    { duration: "30s", target: 100 },
    { duration: "1m", target: 300 },
    { duration: "2m", target: 600 },
    { duration: "1m", target: 1000 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.02"],
  },
};

function cookieHeaderFromResponse(res) {
  if (!res || !res.cookies) return "";
  const pairs = [];
  for (const [key, values] of Object.entries(res.cookies)) {
    if (values && values.length > 0 && values[0].value) {
      pairs.push(`${key}=${values[0].value}`);
    }
  }
  return pairs.join("; ");
}

export function setup() {
  const portalLoginRes = http.post(
    `${BASE_URL}/portal/auth/login`,
    JSON.stringify({
      email: PORTAL_EMAIL,
      password: PORTAL_PASSWORD,
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  const portalData = portalLoginRes.json() || {};
  const portalCookie = cookieHeaderFromResponse(portalLoginRes);

  const adminLoginRes = http.post(
    `${BASE_URL}/internal/auth/login`,
    JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  const adminCookie = cookieHeaderFromResponse(adminLoginRes);

  return {
    portalCookie,
    adminCookie,
    portalToken: portalData.refreshToken || "",
  };
}

export default function (data) {
  const portalHeaders = {
    "Content-Type": "application/json",
    Cookie: data.portalCookie,
    Authorization: `Bearer ${data.portalToken}`,
  };

  const settingsRes = http.get(`${BASE_URL}/api/organization/settings`, {
    headers: portalHeaders,
    tags: { endpoint: "org_settings_get" },
  });
  check(settingsRes, { "org settings get status < 500": (r) => r.status < 500 });

  const promoRes = http.post(
    `${BASE_URL}/api/promo-codes/validate`,
    JSON.stringify({ code: "TESTCODE" }),
    {
      headers: portalHeaders,
      tags: { endpoint: "promo_validate" },
    }
  );
  check(promoRes, { "promo validate status < 500": (r) => r.status < 500 });

  // Concurrent write pressure:
  // first 100 VUs repeatedly write different globalDiscountPercent values.
  if (__VU <= 100) {
    const nextPercent = (__VU + __ITER) % 101;
    const patchRes = http.patch(
      `${BASE_URL}/internal/organization/settings`,
      JSON.stringify({
        globalDiscountPercent: nextPercent,
        globalDiscountActive: nextPercent > 0,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: data.adminCookie,
          "x-org-key": ORG_KEY,
        },
        tags: { endpoint: "org_settings_patch_concurrent" },
      }
    );
    check(patchRes, { "org settings patch status < 500": (r) => r.status < 500 });
  }

  sleep(0.2);
}
