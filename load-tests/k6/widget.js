import http from "k6/http";
import { sleep, check } from "k6";

const API_URL = __ENV.API_URL || "http://localhost:4000";
const ORG_KEY = __ENV.ORG_KEY || "demo";
const SITE_ID = __ENV.SITE_ID || "";

export const options = {
  scenarios: {
    widget_reads_writes: {
      executor: "constant-vus",
      vus: 500,
      duration: "5m",
    },
  },
};

function headers() {
  const base = {
    "Content-Type": "application/json",
    "x-org-key": ORG_KEY,
    "x-visitor-id": `v_${__VU}_${__ITER}`,
  };
  if (SITE_ID) base["x-site-id"] = SITE_ID;
  return base;
}

export default function () {
  const createRes = http.post(`${API_URL}/conversations`, JSON.stringify({}), { headers: headers() });
  check(createRes, { "create conversation ok": (r) => r.status === 201 });

  const id = createRes.json("id");
  if (id) {
    const msgRes = http.post(`${API_URL}/conversations/${id}/messages`, JSON.stringify({
      role: "user",
      content: "Load test message",
    }), { headers: headers() });
    check(msgRes, { "send message ok": (r) => r.status === 201 });
  }

  sleep(1);
}

