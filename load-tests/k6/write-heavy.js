import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";
const ORG_KEY = __ENV.ORG_KEY || "";
const ORIGIN = __ENV.ORIGIN || "http://localhost:3000";

export const options = {
  scenarios: {
    writes: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 200 },
        { duration: "4m", target: 1000 },
        { duration: "4m", target: 1000 },
        { duration: "2m", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
  },
};

function createConversation(visitorId) {
  return http.post(
    `${BASE_URL}/conversations`,
    JSON.stringify({}),
    {
      headers: {
        "content-type": "application/json",
        "x-org-key": ORG_KEY,
        "x-visitor-id": visitorId,
        Origin: ORIGIN,
      },
    }
  );
}

function sendMessage(conversationId, visitorId) {
  return http.post(
    `${BASE_URL}/conversations/${conversationId}/messages`,
    JSON.stringify({ role: "user", content: "Load test message" }),
    {
      headers: {
        "content-type": "application/json",
        "x-org-key": ORG_KEY,
        "x-visitor-id": visitorId,
        Origin: ORIGIN,
      },
    }
  );
}

export default function () {
  const visitorId = `v_${__VU}_${__ITER}`;
  const convRes = createConversation(visitorId);
  check(convRes, { "created conversation": (r) => r.status === 201 });

  if (convRes.status === 201) {
    const body = convRes.json();
    const msgRes = sendMessage(body.id, visitorId);
    check(msgRes, { "sent message": (r) => r.status === 201 });
  }

  sleep(1);
}

