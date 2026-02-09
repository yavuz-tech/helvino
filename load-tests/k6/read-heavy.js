import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";
const ORG_KEY = __ENV.ORG_KEY || "";
const ORIGIN = __ENV.ORIGIN || "http://localhost:3000";
const PORTAL_COOKIE = __ENV.PORTAL_COOKIE || "";

export const options = {
  scenarios: {
    reads: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 500 },
        { duration: "4m", target: 2000 },
        { duration: "6m", target: 5000 },
        { duration: "4m", target: 5000 },
        { duration: "2m", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

function portalRead() {
  return http.get(`${BASE_URL}/portal/conversations?limit=20`, {
    headers: {
      Cookie: PORTAL_COOKIE,
    },
  });
}

function widgetRead() {
  return http.get(`${BASE_URL}/conversations`, {
    headers: {
      "x-org-key": ORG_KEY,
      Origin: ORIGIN,
    },
  });
}

export default function () {
  const res = PORTAL_COOKIE ? portalRead() : widgetRead();
  check(res, {
    "status 200": (r) => r.status === 200,
  });
  sleep(1);
}

