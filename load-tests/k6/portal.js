import http from "k6/http";
import { sleep, check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const API_URL = __ENV.API_URL || "http://localhost:4000";
const PORTAL_EMAIL = __ENV.PORTAL_EMAIL || "owner@demo.helvion.io";
const PORTAL_PASSWORD = __ENV.PORTAL_PASSWORD || "demo_owner_2026";

export const options = {
  scenarios: {
    portal_reads: {
      executor: "constant-vus",
      vus: 200,
      duration: "5m",
    },
  },
};

export function setup() {
  const res = http.post(`${API_URL}/portal/login`, JSON.stringify({
    email: PORTAL_EMAIL,
    password: PORTAL_PASSWORD,
  }), {
    headers: { "Content-Type": "application/json" },
  });

  check(res, { "login ok": (r) => r.status === 200 });
  const cookies = res.cookies;
  return { cookies };
}

export default function (data) {
  const jar = http.cookieJar();
  if (data?.cookies) {
    Object.entries(data.cookies).forEach(([name, cookieList]) => {
      const c = cookieList[0];
      jar.set(API_URL, name, c.value);
    });
  }

  const res = http.get(`${API_URL}/portal/conversations?limit=20`, {
    headers: { "Accept": "application/json" },
  });
  check(res, { "portal conversations ok": (r) => r.status === 200 });

  sleep(1);
}

