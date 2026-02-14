import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";

export const options = {
  stages: [
    { duration: "30s", target: 100 },
    { duration: "1m", target: 500 },
    { duration: "2m", target: 1000 },
    { duration: "1m", target: 2000 },
    { duration: "30s", target: 3000 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
    "http_req_duration{endpoint:health}": ["p(95)<500"],
    "http_req_duration{endpoint:founding_status}": ["p(95)<500"],
    "http_req_duration{endpoint:active_discount}": ["p(95)<500"],
    "http_req_duration{endpoint:currency}": ["p(95)<500"],
  },
};

const ENDPOINTS = [
  { name: "health", path: "/health" },
  { name: "founding_status", path: "/api/founding-member-status" },
  { name: "active_discount", path: "/api/active-discount?orgKey=demo" },
  { name: "currency", path: "/api/currency" },
];

export default function () {
  for (const endpoint of ENDPOINTS) {
    const res = http.get(`${BASE_URL}${endpoint.path}`, {
      tags: { endpoint: endpoint.name },
    });

    check(
      res,
      {
        [`${endpoint.name} status is 200`]: (r) => r.status === 200,
      },
      { endpoint: endpoint.name }
    );
  }

  sleep(0.2);
}
