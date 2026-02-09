import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import session from "@fastify/session";
import socketioServer from "fastify-socket.io";
import type { Socket } from "socket.io";
import { APP_NAME } from "@helvino/shared";
import { store } from "./store";
import { bootloaderRoutes } from "./routes/bootloader";
import { orgAdminRoutes } from "./routes/org-admin";
import { observabilityRoutes } from "./routes/observability";
import { internalAdminRoutes } from "./routes/internal-admin";
import { authRoutes } from "./routes/auth";
import { securityRoutes } from "./routes/security";
import { orgAuthRoutes } from "./routes/org-auth";
import { orgCustomerRoutes } from "./routes/org-customer";
import { portalAuthRoutes } from "./routes/portal-auth";
import { portalSignupRoutes } from "./routes/portal-signup";
import { portalOrgRoutes } from "./routes/portal-org";
import { portalBillingRoutes } from "./routes/portal-billing";
import { portalTeamRoutes } from "./routes/portal-team";
import { portalSecurityRoutes } from "./routes/portal-security";
import { portalMfaRoutes } from "./routes/portal-mfa";
import { adminMfaRoutes } from "./routes/admin-mfa";
import { deviceRoutes } from "./routes/device-routes";
import { recoveryRoutes } from "./routes/recovery-routes";
import { webauthnRoutes } from "./routes/webauthn-routes";
import { stripeWebhookRoutes } from "./routes/stripe-webhook";
import { widgetAnalyticsRoutes } from "./routes/widget-analytics";
import { adminOrgDirectoryRoutes } from "./routes/admin-orgs";
import { portalWidgetConfigRoutes } from "./routes/portal-widget-config";
import { portalWidgetSettingsRoutes } from "./routes/portal-widget-settings";
import { auditLogRoutes } from "./routes/audit-log-routes";
import { portalNotificationRoutes } from "./routes/portal-notifications";
import { portalConversationRoutes } from "./routes/portal-conversations";
import { upsertVisitor } from "./utils/visitor";
import { requestContextPlugin } from "./plugins/request-context";
import { metricsTracker } from "./utils/metrics";
import { createRateLimitMiddleware } from "./middleware/rate-limit";
import { validateOrgKey, validateVisitorId, validateJsonContentType, validateMessageContent } from "./middleware/validation";
import { validateDomainAllowlist } from "./middleware/domain-allowlist";
import { requireOrgToken } from "./middleware/require-org-token";
import { isBillingWriteBlocked } from "./utils/billing-enforcement";
import { enforceWidgetBillingLock } from "./middleware/billing-lock";
import { RedisSessionStore } from "./utils/redis-session-store";
import { hostTrustPlugin } from "./middleware/host-trust";
import { securityHeadersPlugin } from "./middleware/security-headers";
import {
  checkConversationEntitlement,
  checkMessageEntitlement,
  checkM2Entitlement,
  checkM3Entitlement,
  recordConversationUsage,
  recordMessageUsage,
  recordM2Usage,
  recordM3Usage,
} from "./utils/entitlements";
import type {
  CreateConversationResponse,
  CreateMessageRequest,
  CreateMessageResponse,
  Conversation,
  ConversationDetail,
} from "./types";

const PORT = parseInt(process.env.PORT || "4000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// Configure trusted proxies
// In production, set TRUSTED_PROXIES to your actual proxy IPs (comma-separated)
// Example: TRUSTED_PROXIES="10.0.0.1,172.16.0.1" or "loopback,linklocal,uniquelocal"
const trustedProxies = process.env.TRUSTED_PROXIES
  ? process.env.TRUSTED_PROXIES.split(",").map((s) => s.trim())
  : ["127.0.0.1", "::1"]; // Default: trust only localhost (for dev)

// Initialize Fastify
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
  bodyLimit: 32 * 1024, // 32KB max body size
  trustProxy: trustedProxies, // Only trust specific proxy IPs to prevent X-Forwarded-For spoofing
});

// Register plugins
fastify.register(cors, {
  origin: true, // Allow all origins in development
  credentials: true, // Allow cookies in CORS requests
});

// Register cookie support (required for sessions)
fastify.register(cookie);

// Capture raw JSON body for Stripe webhook verification
fastify.addContentTypeParser(
  "application/json",
  { parseAs: "buffer" },
  (request, body, done) => {
    const raw = body.toString("utf8");
    if (request.url === "/stripe/webhook" || request.url === "/webhooks/stripe") {
      (request as any).rawBody = raw;
    }
    try {
      const parsed = raw.length ? JSON.parse(raw) : {};
      done(null, parsed);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
);

// Register session support with secure settings
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const sessionStore = new RedisSessionStore(7 * 24 * 60 * 60); // 7 days TTL

fastify.register(session, {
  secret: sessionSecret,
  store: sessionStore as any,
  cookie: {
    secure: isProduction, // HTTPS only in production
    httpOnly: true, // Prevent JavaScript access
    sameSite: "lax", // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: "/", // Cookie available for all paths
  },
  saveUninitialized: false, // Don't create session until something stored
  rolling: true, // Reset maxAge on every request
});

fastify.register(socketioServer, {
  cors: {
    origin: "*", // Allow all origins for Socket.IO in development
  },
});

fastify.register(requestContextPlugin);
fastify.register(hostTrustPlugin);
fastify.register(securityHeadersPlugin);

// Metrics tracking (global onResponse hook)
fastify.addHook("onResponse", async (request, reply) => {
  // Ensure startTime is set (from requestContextPlugin)
  if (request.startTime) {
    const latencyMs = Date.now() - request.startTime;
    const route = request.routeOptions?.url || request.url;
    
    // Skip health/metrics endpoints to avoid noise
    if (!route.includes("/health") && !route.includes("/metrics")) {
      metricsTracker.recordRequest(reply.statusCode, latencyMs, route);
    }
  }
});

// Register routes
fastify.register(authRoutes); // Internal admin auth (no prefix)
fastify.register(orgAuthRoutes); // Org user auth (customer portal, no prefix)
fastify.register(portalAuthRoutes); // Portal auth (no prefix)
fastify.register(portalSignupRoutes); // Portal self-serve signup (Step 11.36)
fastify.register(portalBillingRoutes); // Portal billing
fastify.register(observabilityRoutes); // Health + metrics
fastify.register(bootloaderRoutes, { prefix: "/api" });
fastify.register(orgAdminRoutes, { prefix: "/api" });
fastify.register(securityRoutes, { prefix: "/api" }); // Security management
fastify.register(internalAdminRoutes); // Internal admin (no prefix)
fastify.register(orgCustomerRoutes); // Org customer routes (customer portal, no prefix)
fastify.register(portalConversationRoutes); // Portal conversation management (Step 11.47/11.48) — MUST be before portalOrgRoutes
fastify.register(portalOrgRoutes); // Portal org routes (no prefix)
fastify.register(portalTeamRoutes); // Portal team management (no prefix)
fastify.register(portalSecurityRoutes); // Portal security: password reset, sessions (no prefix)
fastify.register(portalMfaRoutes); // Portal MFA: TOTP setup, verify, challenge (no prefix)
fastify.register(adminMfaRoutes); // Admin MFA: TOTP setup, verify, challenge (no prefix)
fastify.register(deviceRoutes); // Device management: admin + portal (no prefix)
fastify.register(recoveryRoutes); // Account recovery + emergency access (no prefix)
fastify.register(webauthnRoutes); // WebAuthn passkeys: admin + portal (no prefix)
fastify.register(stripeWebhookRoutes); // Stripe webhooks
fastify.register(widgetAnalyticsRoutes); // Widget analytics + health (no prefix)
fastify.register(adminOrgDirectoryRoutes); // Admin org directory (Step 11.39)
fastify.register(portalWidgetConfigRoutes); // Portal widget config + domains (Step 11.40)
fastify.register(portalWidgetSettingsRoutes); // Portal widget appearance settings (Step 11.52)
fastify.register(auditLogRoutes); // Audit log routes: portal + admin (Step 11.42)
fastify.register(portalNotificationRoutes); // Portal notifications (Step 11.43)

// Root info
fastify.get("/", async () => {
  return {
    app: APP_NAME,
    version: "1.0.0",
    status: "operational",
    endpoints: {
      health: "GET /health",
      conversations: {
        list: "GET /conversations",
        create: "POST /conversations",
        detail: "GET /conversations/:id",
        addMessage: "POST /conversations/:id/messages",
      },
    },
  };
});

// Create conversation
fastify.post<{
  Reply: CreateConversationResponse | { error: string; code?: string };
}>("/conversations", {
  preHandler: [
    createRateLimitMiddleware({ limit: 30, windowMs: 60000 }), // 30 per minute
    requireOrgToken, // Require valid org token (or internal bypass)
    enforceWidgetBillingLock,
    validateVisitorId,
    validateJsonContentType,
    validateDomainAllowlist(), // Widget endpoint: enforce domain allowlist
  ],
}, async (request, reply) => {
  // Org is already validated and attached by requireOrgToken middleware
  const org = request.org!;
  const visitorKey = request.headers["x-visitor-id"] as string | undefined;
  const userAgent = request.headers["user-agent"] as string | undefined;

  const internalKey = request.headers["x-internal-key"] as string | undefined;
  const isAdminBypass =
    Boolean(request.session.adminUserId) ||
    (INTERNAL_API_KEY && internalKey === INTERNAL_API_KEY);

  if (!isAdminBypass && isBillingWriteBlocked(org)) {
    reply.code(402);
    return { error: "payment_required" };
  }

  const entitlement = await checkConversationEntitlement(org.id);
  if (!entitlement.allowed) {
    reply.code(402);
    return { error: entitlement.error || "Plan limit exceeded", code: entitlement.code };
  }

  // Upsert visitor if visitorKey provided
  let visitorId: string | undefined;
  if (visitorKey) {
    try {
      const visitor = await upsertVisitor(org.id, visitorKey, userAgent);
      visitorId = visitor.id;
    } catch (error) {
      console.error("Failed to upsert visitor:", error);
      // Continue without visitor (backward compatible)
    }
  }

  const conversation = await store.createConversation(org.id, visitorId);
  await recordConversationUsage(org.id);
  let m3Limited = false;
  if (visitorKey) {
    const m3Entitlement = await checkM3Entitlement(org.id);
    if (m3Entitlement.allowed) {
      recordM3Usage(org.id, visitorKey).catch(() => {});
    } else {
      m3Limited = true;
    }
  }

  reply.code(201);
  return {
    id: conversation.id,
    createdAt: conversation.createdAt,
    m3Limited,
  };
});

// List conversations
fastify.get<{
  Reply: Conversation[] | { error: string };
}>("/conversations", async (request, reply) => {
  const orgKey = request.headers["x-org-key"] as string;

  if (!orgKey) {
    reply.code(401);
    return { error: "Missing x-org-key header" };
  }

  const org = await store.getOrganizationByKey(orgKey);
  if (!org) {
    reply.code(401);
    return { error: "Invalid organization key" };
  }

  return await store.listConversations(org.id);
});

// Get conversation detail with messages
fastify.get<{
  Params: { id: string };
  Reply: ConversationDetail | { error: string };
}>("/conversations/:id", async (request, reply) => {
  const { id } = request.params;
  const orgKey = request.headers["x-org-key"] as string;

  if (!orgKey) {
    reply.code(401);
    return { error: "Missing x-org-key header" };
  }

  const org = await store.getOrganizationByKey(orgKey);
  if (!org) {
    reply.code(401);
    return { error: "Invalid organization key" };
  }

  const conversation = await store.getConversationWithMessages(id, org.id);

  if (!conversation) {
    reply.code(404);
    return { error: "Conversation not found" };
  }

  return conversation;
});

// Add message to conversation
fastify.post<{
  Params: { id: string };
  Body: CreateMessageRequest;
  Reply:
    | CreateMessageResponse
    | {
        error:
          | string
          | {
              code: string;
              message: string;
              resetAt?: string | null;
            };
        code?: string;
      };
}>("/conversations/:id/messages", {
  preHandler: [
    createRateLimitMiddleware({ limit: 120, windowMs: 60000 }), // 120 per minute
    requireOrgToken, // Require valid org token (or internal bypass)
    enforceWidgetBillingLock,
    validateVisitorId,
    validateJsonContentType,
    validateMessageContent,
    validateDomainAllowlist(), // Widget endpoint: enforce domain allowlist
  ],
}, async (request, reply) => {
  const { id } = request.params;
  const { role, content } = request.body;
  // Org is already validated and attached by requireOrgToken middleware
  const org = request.org!;

  const internalKey = request.headers["x-internal-key"] as string | undefined;
  const isAdminBypass =
    Boolean(request.session.adminUserId) ||
    (INTERNAL_API_KEY && internalKey === INTERNAL_API_KEY);

  if (!isAdminBypass && isBillingWriteBlocked(org)) {
    reply.code(402);
    return { error: "payment_required" };
  }

  // Validate input
  if (!role || !content) {
    reply.code(400);
    return { error: "Missing required fields: role, content" };
  }

  if (role !== "user" && role !== "assistant") {
    reply.code(400);
    return { error: "Invalid role. Must be 'user' or 'assistant'" };
  }

  const entitlement = await checkMessageEntitlement(org.id);
  if (!entitlement.allowed) {
    reply.code(402);
    return { error: entitlement.error || "Plan limit exceeded", code: entitlement.code };
  }

  if (role === "assistant") {
    const m2Entitlement = await checkM2Entitlement(org.id);
    if (!m2Entitlement.allowed) {
      reply.code(402);
      return {
        error: {
          code: "QUOTA_M2_EXCEEDED",
          message: m2Entitlement.error || "M2 quota exceeded",
          resetAt: m2Entitlement.resetAt || null,
        },
      };
    }
  }

  const message = await store.addMessage(id, org.id, role, content);

  if (!message) {
    reply.code(404);
    return { error: "Conversation not found" };
  }

  // Emit Socket.IO event to org room only
  fastify.io.to(`org:${org.id}`).emit("message:new", {
    conversationId: id,
    message,
  });

  await recordMessageUsage(org.id);
  if (role === "assistant") {
    recordM2Usage(org.id).catch(() => {});
  }

  reply.code(201);
  return message;
});

// Socket.IO connection handlers with org-based rooms
fastify.ready().then(() => {
  fastify.io.on("connection", async (socket: Socket) => {
    const orgKey = socket.handshake.auth?.orgKey as string;

    if (!orgKey) {
      console.log(`❌ Socket rejected (no orgKey): ${socket.id}`);
      socket.disconnect();
      return;
    }

    const org = await store.getOrganizationByKey(orgKey);
    if (!org) {
      console.log(`❌ Socket rejected (invalid orgKey): ${socket.id}`);
      socket.disconnect();
      return;
    }

    // Join organization room
    const roomName = `org:${org.id}`;
    socket.join(roomName);
    console.log(`✅ Socket connected: ${socket.id} → ${roomName} (${org.name})`);

    // ── Typing indicator relay ──
    socket.on("typing:start", (data: { conversationId?: string }) => {
      socket.to(roomName).emit("user:typing", { conversationId: data?.conversationId || "" });
    });
    socket.on("typing:stop", (data: { conversationId?: string }) => {
      socket.to(roomName).emit("user:typing:stop", { conversationId: data?.conversationId || "" });
    });
    socket.on("agent:typing:start", (data: { conversationId?: string }) => {
      socket.to(roomName).emit("agent:typing", { conversationId: data?.conversationId || "" });
    });
    socket.on("agent:typing:stop", (data: { conversationId?: string }) => {
      socket.to(roomName).emit("agent:typing:stop", { conversationId: data?.conversationId || "" });
    });

    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected: ${socket.id} from ${roomName}`);
    });
  });
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`\n🚀 ${APP_NAME} API is running!`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API docs: http://localhost:${PORT}/`);
    console.log(`🔌 Socket.IO enabled on the same port\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
