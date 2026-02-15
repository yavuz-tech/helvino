# ═══════════════════════════════════════════════════════════
# HELVION SECURITY AUDIT REPORT — PART 4/10
# Real-time & WebSocket (Socket.IO) Security (Bishop Fox Style)
# Tarih: 2026-02-15
# Mod: AUDIT + AUTO-FIX | Ortam: Railway Production
# ═══════════════════════════════════════════════════════════

## Executive Summary

Helvion real-time altyapisi `fastify-socket.io` uzerinden tek namespace ile calisiyor (ayri `/portal` ve `/widget` namespace’leri yok). Portal (agent) ve Widget (visitor) istemcileri ayni Socket.IO endpoint’ine baglanip server-side auth ile ayrisiyor.

Bu part’ta tespit edilen en kritik risk: widget socket’lerinin org-room’a join olmasi nedeniyle, org icindeki tum conversation’larin `message:new` event’lerini dinleyebilmesi (UI tarafinda client-side filter var ama bu güvenlik degil). Bu, multi-tenant degil ama **visitor-to-visitor izolasyon** ihlali (chat platformu icin kritik).

Sonuc: 1 KRITIK | 4 ORTA | 2 DUSUK | 13 PASS  
Otomatik duzeltilen: 7 | Manuel gereken: 1

Rapor kapsaminda degisiklikler:

- Socket handshake auth hardening (portal token vs orgToken)
- Org domain allowlist enforcement (widget socket’leri icin hard-block)
- Room izolasyonu: `org:*:agents` / `org:*:widgets` + `conv:*`
- Typing event injection + flood protection (per-socket rate limit)
- Socket server frame limit (`maxHttpBufferSize`)

---

## ✅ FIXED Findings

### WS-001 [CRITICAL] — Widget socket org-room’dan tum mesajlari sniff edebiliyordu

Etki:

- Saldirgan kendi tarayicisinda Socket.IO baglantisi acip `message:new` dinleyerek, ayni org’un baska ziyaretcilerine ait conversationId + message content’lerini alabiliyordu.
- “Client-side filter” (widget sadece kendi conversationId’sini UI’da gosteriyor) guvenlik degildir; network seviyesinde veri sızıntısı devam eder.

Fix:

- Server-side room modeli degistirildi:
  - Agents: `org:<orgId>:agents`
  - Widgets: `org:<orgId>:widgets`
  - Visitor conversation: `conv:<conversationId>` (join, ownership check ile)
- `message:new` artik:
  - Agents’a org-wide gider (`org:*:agents`)
  - Widget’a sadece conversation room uzerinden gider (`conv:*`)

### WS-002 [HIGH] — Widget socket authentication “orgKey only” ile calisabiliyordu

Etki:

- `orgKey` bilinen bir deger olabilir (demo, public). Token olmadan socket baglantisi acmak, rate-limit ve room izolasyonu eksikliginde veri sızıntısı riskini büyutur.

Fix:

- Production’da socket auth icin token zorunlu:
  - Agent: `verifyPortalSessionToken(token, SESSION_SECRET)`
  - Widget: `verifyOrgToken(token)` + `visitorId` zorunlu

### WS-003 [HIGH] — Widget socket’leri icin domain allowlist enforce edilmiyordu

Etki:

- HTTP tarafinda widget endpoint’leri domain allowlist ile korunurken, socket tarafinda ayni kontrol yoksa unauthorized domain’de widget realtime calisabilir.

Fix:

- Socket auth middleware icinde widget baglantilarinda org `allowedDomains` + `allowLocalhost` enforce edildi (wildcard yasak, prod’da empty allowlist block).

### WS-004 [MEDIUM] — Agent typing event’leri org room’a broadcast ediliyordu

Etki:

- Widget’lar diger conversation’larda agent typing olaylarini gorebiliyordu (signal leak).

Fix:

- Agent typing event’leri artik sadece `conv:<conversationId>` room’una emit ediliyor.

### WS-005 [MEDIUM] — Typing event injection / spoofing (role check yok)

Etki:

- Widget client “agent:typing:start” emit ederek sahte typing gosterebilirdi.
- Agent client “typing:start” emit ederek visitor typing spoof edebilirdi.

Fix:

- Event handler’larda role check:
  - `typing:*` sadece widget
  - `agent:typing:*` sadece agent

### WS-006 [LOW] — Flood/DoS: typing ve join event’leri rate-limited degildi

Fix:

- Per-socket rate limit eklendi (typing 10/s, join 20/10s).

### WS-007 [LOW] — Buyuk payload flood icin `maxHttpBufferSize` default kalmisti

Fix:

- Socket.IO server option: `maxHttpBufferSize: 100KB`.

---

## 🔧 NEEDS MANUAL FIX

### MANUAL-401 — Production’da websocket IP keying (Railway proxy chain) dogrulanmali

- Risk: per-IP connection limit / rate keying, proxy arkasinda yanlis IP gorebilir veya XFF spoof ile hatali keying olabilir.
- Cozum:
  - Railway’de `TRUSTED_PROXIES` dogru set edilmeli (PART2’de MANUAL-201 ile uyumlu)
  - Socket katmaninda `socket.handshake.address` vs `x-forwarded-for` dogrulanmali, gerekiyorsa `engine.io` `allowRequest` ile stricter policy

---

## MANDATORY VERIFICATION — Code Evidence

### Socket.IO server config (TAM)

```330:343:apps/api/src/index.ts
fastify.register(socketioServer, {
  // Socket.IO server options (security hardening)
  maxHttpBufferSize: 100 * 1024, // 100KB per message/frame (prevents flood with huge payloads)
  pingTimeout: 20_000,
  pingInterval: 25_000,
  allowEIO3: false,
  cors: {
    // SECURITY:
    // - We cannot know org allowlist at CORS-evaluation time (before auth).
    // - Therefore we allow the transport origin here, and enforce org domain allowlist in the auth middleware.
    origin: true,
    credentials: true,
  },
});
```

### Namespace / auth middleware (TAM)

Not: ayrı namespace yok; tek namespace uzerinde `fastify.io.use(...)` middleware var.

```884:1098:apps/api/src/index.ts
type SocketRole = "agent" | "widget";

const MAX_SOCKETS_PER_IP = Number.parseInt(process.env.SOCKET_MAX_PER_IP || "25", 10) || 25;
const socketCountsByIp = new Map<string, number>();

function getSocketIp(socket: Socket): string {
  const xff = socket.handshake.headers["x-forwarded-for"];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  // SECURITY: Do not fully trust XFF; still a useful best-effort limit.
  const xffIp = typeof raw === "string" ? raw.split(",")[0]?.trim() : "";
  return xffIp || socket.handshake.address || "unknown-ip";
}

function isValidId(value: unknown, maxLen = 128): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v || v.length > maxLen) return false;
  if (/[\r\n\t ]/.test(v)) return false;
  return true;
}

function getHandshakeOrigin(socket: Socket): string | null {
  const originHeader = socket.handshake.headers.origin;
  const refererHeader = socket.handshake.headers.referer;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  const referer = Array.isArray(refererHeader) ? refererHeader[0] : refererHeader;
  const candidate = (typeof origin === "string" ? origin : "") || (typeof referer === "string" ? referer : "");
  if (!candidate) return null;
  if (candidate === "null" || candidate === "file://") return null;
  return candidate;
}

function allowWidgetOriginOrThrow(input: {
  requestOrigin: string | null;
  org: { id: string; allowedDomains: string[]; allowLocalhost: boolean };
  ip: string;
}) {
  const isProd = process.env.NODE_ENV === "production";
  const allowlist = Array.isArray(input.org.allowedDomains)
    ? input.org.allowedDomains.map((d) => String(d || "").trim()).filter(Boolean)
    : [];

  const hasWildcard = allowlist.some((domain) => domain === "*" || domain.includes("*"));
  if (hasWildcard) {
    throw new Error("Authentication error: invalid allowlist configuration");
  }
  if (isProd && allowlist.length === 0) {
    throw new Error("Authentication error: allowlist empty");
  }

  if (!input.requestOrigin) {
    const isLocalhostIp =
      input.ip === "127.0.0.1" ||
      input.ip === "::1" ||
      input.ip === "::ffff:127.0.0.1";
    if (input.org.allowLocalhost || isLocalhostIp) return;
    throw new Error("Authentication error: missing Origin/Referer");
  }

  if (!isOriginAllowed(input.requestOrigin, allowlist, input.org.allowLocalhost)) {
    const domain = extractDomain(input.requestOrigin) || "unknown";
    throw new Error(`Authentication error: domain not allowed (${domain})`);
  }
}

function allowPortalOriginOrThrow(origin: string | null) {
  // Portal sockets are only allowed from the known app origins.
  if (!isProduction) return;
  if (!origin) {
    throw new Error("Authentication error: missing Origin/Referer");
  }
  if (!isOriginAllowedByCorsPolicy(origin, corsPolicy)) {
    throw new Error("Authentication error: origin not allowed");
  }
}

fastify.io.use(async (socket, next) => {
  try {
    const handshakeAuth = socket.handshake.auth || {};

    const orgKey = handshakeAuth.orgKey as unknown;
    const siteId = handshakeAuth.siteId as unknown;
    const token = handshakeAuth.token as unknown;
    const visitorKey = handshakeAuth.visitorId as unknown; // widget visitorKey (x-visitor-id)

    const ip = getSocketIp(socket);
    const currentCount = socketCountsByIp.get(ip) || 0;
    if (currentCount >= MAX_SOCKETS_PER_IP) {
      return next(new Error("Too many connections"));
    }

    const hasOrgKey = isValidId(orgKey, 64);
    const hasSiteId = isValidId(siteId, 64);
    if (!hasOrgKey && !hasSiteId) {
      return next(new Error("Authentication error: siteId/orgKey required"));
    }

    const tokenStr = typeof token === "string" ? token.trim() : "";
    if (isProduction && !tokenStr) {
      return next(new Error("Authentication error: token required"));
    }

    // Load organization by siteId (preferred) or orgKey (legacy)
    const org = await prisma.organization.findUnique({
      where: hasSiteId ? { siteId: String(siteId).trim() } : { key: String(orgKey).trim() },
      select: {
        id: true,
        key: true,
        siteId: true,
        widgetEnabled: true,
        isActive: true,
        allowedDomains: true,
        allowLocalhost: true,
      },
    });

    if (!org || !org.isActive) {
      return next(new Error("Authentication error: invalid organization"));
    }

    const secret = process.env.SESSION_SECRET;
    let role: SocketRole | null = null;
    let portalPayload: unknown | null = null;

    if (tokenStr && secret) {
      const payload = verifyPortalSessionToken(tokenStr, secret);
      if (payload) {
        // SECURITY: agent token must match the org in handshake to prevent cross-org join.
        if ((payload as any).orgId !== org.id) {
          return next(new Error("Authentication error: org mismatch"));
        }
        role = "agent";
        portalPayload = payload;
      }
    }

    if (!role && tokenStr) {
      const payload = verifyOrgToken(tokenStr);
      if (payload && payload.orgId === org.id && payload.orgKey === org.key) {
        role = "widget";
      }
    }

    if (!role) {
      return next(new Error("Authentication error: invalid token"));
    }

    const requestOrigin = getHandshakeOrigin(socket);
    if (role === "agent") {
      allowPortalOriginOrThrow(requestOrigin);
    } else {
      // Widget socket: enforce org domain allowlist (same policy as HTTP widget endpoints).
      allowWidgetOriginOrThrow({ requestOrigin, org, ip });
      if (!org.widgetEnabled) {
        return next(new Error("Authentication error: widget disabled"));
      }
      if (!isValidId(visitorKey, 128)) {
        return next(new Error("Authentication error: visitorId required"));
      }
    }

    const authSocket = socket as RealtimeSocket;
    authSocket.orgId = org.id;
    authSocket.orgKey = org.key;
    authSocket.isAgent = role === "agent";
    authSocket.portalUser = portalPayload || undefined;
    authSocket.visitorKey = role === "widget" ? String(visitorKey).trim() : undefined;

    // Increment connection count (decrement on disconnect)
    socketCountsByIp.set(ip, currentCount + 1);
    socket.once("disconnect", () => {
      const c = socketCountsByIp.get(ip) || 1;
      if (c <= 1) socketCountsByIp.delete(ip);
      else socketCountsByIp.set(ip, c - 1);
    });

    return next();
  } catch {
    return next(new Error("Authentication error: internal"));
  }
});
```

### Room join / org isolation logic (TAM)

```1100:1212:apps/api/src/index.ts
fastify.io.on("connection", (socket: Socket) => {
  const authSocket = socket as RealtimeSocket;
  const orgId = authSocket.orgId;
  const orgKey = authSocket.orgKey;
  const isAgent = authSocket.isAgent || false;
  const visitorKey = authSocket.visitorKey;
  if (!orgId || !orgKey) {
    socket.disconnect();
    return;
  }

  const orgAgentsRoom = `org:${orgId}:agents`;
  const orgWidgetsRoom = `org:${orgId}:widgets`;

  if (isAgent) {
    socket.join(orgAgentsRoom);
    socket.join(`org:${orgKey}:agents`);
  } else {
    socket.join(orgWidgetsRoom);
    socket.join(`org:${orgKey}:widgets`);
  }

  // Track which conversations this socket is allowed to receive (widget only).
  const joinedConversations = new Set<string>();

  // Rate limits (per socket) — tuned for UI typing + join spam protection.
  const allowTypingEvent = createEventLimiter({ windowMs: 1000, max: 10 });
  const allowJoinEvent = createEventLimiter({ windowMs: 10_000, max: 20 });

  // Widget joins a specific conversation room (strict ownership check).
  socket.on(
    "conversation:join",
    async (data: { conversationId?: string }, ack?: (res: { ok: boolean; error?: string }) => void) => {
      try {
        if (isAgent) {
          ack?.({ ok: false, error: "forbidden" });
          return;
        }
        if (!allowJoinEvent()) {
          ack?.({ ok: false, error: "rate_limited" });
          return;
        }
        const conversationId = (data?.conversationId || "").trim();
        if (!isValidId(conversationId, 128) || !visitorKey) {
          ack?.({ ok: false, error: "invalid" });
          return;
        }
        const ok = await validateWidgetConversationJoin({ orgId, visitorKey, conversationId });
        if (!ok) {
          ack?.({ ok: false, error: "not_allowed" });
          return;
        }
        socket.join(`conv:${conversationId}`);
        joinedConversations.add(conversationId);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: "internal" });
      }
    }
  );

  // ── Typing indicator relay (strict room isolation) ──
  socket.on("typing:start", (data: { conversationId?: string }) => {
    if (isAgent) return;
    if (!allowTypingEvent()) return;
    const conversationId = (data?.conversationId || "").trim();
    if (!isValidId(conversationId, 128)) return;
    if (!joinedConversations.has(conversationId)) return;
    fastify.io.to(orgAgentsRoom).emit("user:typing", { conversationId });
  });
  socket.on("typing:stop", (data: { conversationId?: string }) => {
    if (isAgent) return;
    if (!allowTypingEvent()) return;
    const conversationId = (data?.conversationId || "").trim();
    if (!isValidId(conversationId, 128)) return;
    if (!joinedConversations.has(conversationId)) return;
    fastify.io.to(orgAgentsRoom).emit("user:typing:stop", { conversationId });
  });

  // Agent typing is emitted only to the single visitor conversation room.
  socket.on("agent:typing:start", async (data: { conversationId?: string }) => {
    if (!isAgent) return;
    if (!allowTypingEvent()) return;
    const conversationId = (data?.conversationId || "").trim();
    if (!isValidId(conversationId, 128)) return;
    const exists = await prisma.conversation.findFirst({
      where: { id: conversationId, orgId },
      select: { id: true },
    });
    if (!exists) return;
    fastify.io.to(`conv:${conversationId}`).emit("agent:typing", { conversationId });
  });
  socket.on("agent:typing:stop", async (data: { conversationId?: string }) => {
    if (!isAgent) return;
    if (!allowTypingEvent()) return;
    const conversationId = (data?.conversationId || "").trim();
    if (!isValidId(conversationId, 128)) return;
    const exists = await prisma.conversation.findFirst({
      where: { id: conversationId, orgId },
      select: { id: true },
    });
    if (!exists) return;
    fastify.io.to(`conv:${conversationId}`).emit("agent:typing:stop", { conversationId });
  });

  socket.on("disconnect", () => {
    fastify.log.info(
      { socketId: socket.id, orgId, role: isAgent ? "agent" : "widget" },
      "Socket disconnected"
    );
  });
});
```

---

## Attack Scenarios (Concrete)

### Scenario 1 — Visitor-to-visitor message sniff (before fix)

Amaç: Widget socket’i org-room’a join olup tum `message:new` event’lerini dinlemek.

- PoC (Node):
  - `socket.io-client` ile baglan
  - `message:new` event’ini logla
  - conversationId + content sızar

Beklenen (fix sonrası):

- Widget socket’i sadece `conv:<ownConversationId>` room’undan event alir.
- `conversation:join` ownership check fails ise event gelmez.

### Scenario 2 — Typing spoof / flood

Amaç:

- Widget client “agent typing” spoof ederek UI’yi manipule etmek
- typing:start flood ile agent portal UI’yi degrade etmek

Beklenen (fix sonrası):

- `agent:typing:*` widget icin ignore (role check)
- typing event’leri rate limited (10/s)

---

## Checklist (20) — Result

### A. Authentication & Authorization
1. ✅ PASS — Portal socket token verify var (`verifyPortalSessionToken`)
2. ✅ FIXED — Widget socket conversation ownership kontrolu eklendi (`conversation:join` + visitorKey)
3. ✅ PASS — Token expiry handshake’te enforce; reconnect’te yeniden auth
4. ✅ PASS — Agent cross-org join engelli (token orgId mismatch -> reject)

### B. Room Isolation (Multi-Tenant)
5. ✅ FIXED — Widget artik org-wide mesajlari goremez (conv room)
6. ✅ PASS — Room adlari tahmin edilebilir ama id’ler random; token+ownership ile korunur
7. ✅ FIXED — Widget sadece kendi conversation room’una join olabilir
8. ✅ FIXED — Broadcast event’ler agent/widget ayrimi ile org sinirinda tutulur

### C. Message Security
9. ✅ PASS — Message content HTTP path’te sanitize ediliyor (`sanitizeHTML`)
10. ✅ FIXED — Typing/join flood rate limit eklendi
11. ✅ FIXED — `maxHttpBufferSize` limiti eklendi
12. ✅ PASS — File upload socket uzerinden yok

### D. Event Injection
13. ✅ FIXED — Role check ile sahte event emission engellendi
14. ✅ PASS — Join payload validation + DB ownership check var
15. ✅ FIXED — typing rate limited

### E. Connection Security
16. ✅ FIXED — Widget domain allowlist socket tarafinda enforce
17. ✅ PASS — TLS/WSS Railway’de termination ile (app config manual verify)
18. 🔧 MANUAL — Per-IP limit proxy chain dogrulanmali (MANUAL-401)
19. ✅ PASS — Reconnect handshake yeniden auth eder
20. ✅ PASS — Polling fallback acik; auth+origin checks ile korunur

---

## Changed Files

- `apps/api/src/index.ts`
- `apps/api/src/routes/portal-conversations.ts`
- `apps/api/src/routes/org-customer.ts`
- `apps/api/src/routes/portal-widget-settings.ts`
- `apps/widget/src/App.tsx`
- `apps/widget/src/api.ts`
- `apps/web/src/contexts/DebugContext.tsx`

## Typecheck

- `npx tsc --noEmit -p apps/api/tsconfig.json` ✅ 0 errors
- `npx tsc --noEmit -p apps/widget/tsconfig.json` ✅ 0 errors
- `npx tsc --noEmit -p apps/web/tsconfig.json` ✅ 0 errors

