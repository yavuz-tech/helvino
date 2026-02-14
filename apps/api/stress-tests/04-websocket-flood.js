import ws from "k6/ws";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const WS_URL =
  __ENV.WS_URL || "ws://localhost:4000/socket.io/?EIO=4&transport=websocket";

const wsConnectSuccess = new Rate("ws_connect_success_rate");
const wsMessagesSent = new Counter("ws_messages_sent");
const wsSessionDuration = new Trend("ws_session_duration_ms");

export const options = {
  stages: [
    { duration: "30s", target: 100 },
    { duration: "1m", target: 250 },
    { duration: "2m", target: 500 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    ws_connect_success_rate: ["rate>0.95"],
    checks: ["rate>0.95"],
  },
};

export default function () {
  const startedAt = Date.now();

  const response = ws.connect(WS_URL, {}, function (socket) {
    socket.on("open", () => {
      // Socket.IO connect packet.
      socket.send("40");

      // Send 10 messages at 1s intervals.
      for (let i = 0; i < 10; i++) {
        socket.setTimeout(() => {
          socket.send(`42["stress_message",{"vu":${__VU},"seq":${i}}]`);
          wsMessagesSent.add(1);
        }, i * 1000);
      }

      socket.setTimeout(() => {
        socket.close();
      }, 11000);
    });

    socket.on("error", () => {
      wsConnectSuccess.add(false);
    });

    socket.on("close", () => {
      wsSessionDuration.add(Date.now() - startedAt);
    });
  });

  const ok = check(response, {
    "websocket upgrade status 101": (r) => r && r.status === 101,
  });
  wsConnectSuccess.add(ok);

  sleep(0.2);
}
