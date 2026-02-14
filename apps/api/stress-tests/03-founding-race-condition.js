import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";
const PORTAL_EMAIL = __ENV.PORTAL_EMAIL || "owner@demo.helvion.io";
const PORTAL_PASSWORD = __ENV.PORTAL_PASSWORD || "demo_owner_2026";

export const options = {
  scenarios: {
    founding_race: {
      executor: "shared-iterations",
      vus: 500,
      iterations: 500,
      maxDuration: "2m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.1"],
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
  const loginRes = http.post(
    `${BASE_URL}/portal/auth/login`,
    JSON.stringify({
      email: PORTAL_EMAIL,
      password: PORTAL_PASSWORD,
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  return {
    cookie: cookieHeaderFromResponse(loginRes),
  };
}

export default function (data) {
  const res = http.post(
    `${BASE_URL}/api/checkout`,
    JSON.stringify({
      planKey: "starter",
      period: "yearly",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Cookie: data.cookie,
        // Synthetic marker to emulate distinct callers in logs.
        "x-test-vu": String(__VU),
      },
      tags: { endpoint: "checkout_yearly_race" },
    }
  );

  // Stripe price missing may return 4xx in test mode; 5xx is unacceptable.
  check(res, {
    "checkout race status not 5xx": (r) => r.status < 500,
  });
}

export function teardown() {
  const statusRes = http.get(`${BASE_URL}/api/founding-member-status`, {
    tags: { endpoint: "founding_status_final" },
  });

  const data = statusRes.json() || {};
  const count = Number(data.count || 0);

  check(statusRes, {
    "founding status endpoint returns 200": (r) => r.status === 200,
    "founding member count <= 200": () => count <= 200,
  });

  if (count > 200) {
    console.error(
      `[RACE CONDITION] Founding member count exceeded limit: count=${count}, limit=200`
    );
  } else {
    console.log(`[RACE CHECK] Founding member count within limit: count=${count}/200`);
  }
}
