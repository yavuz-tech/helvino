import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import session from "@fastify/session";
import socketioServer from "fastify-socket.io";
import type { Socket } from "socket.io";
import cron from "node-cron";
import { APP_NAME } from "@helvino/shared";
import { store } from "./store";
import { bootloaderRoutes } from "./routes/bootloader";
import { orgAdminRoutes } from "./routes/org-admin";
import { observabilityRoutes } from "./routes/observability";
import { internalAdminRoutes } from "./routes/internal-admin";
import { authRoutes } from "./routes/admin-auth";
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
import { analyticsRoutes } from "./routes/analytics";
import { adminOrgDirectoryRoutes } from "./routes/admin-orgs";
import { portalWidgetConfigRoutes } from "./routes/portal-widget-config";
import { portalAiConfigRoutes } from "./routes/portal-ai-config";
import { portalWidgetSettingsRoutes } from "./routes/portal-widget-settings";
import { portalDashboardRoutes } from "./routes/portal-dashboard";
import { portalAiInboxRoutes } from "./routes/portal-ai-inbox";
import { auditLogRoutes } from "./routes/audit-log-routes";
import { portalNotificationRoutes } from "./routes/portal-notifications";
import { portalConversationRoutes } from "./routes/portal-conversations";
import { portalOperatingHoursRoutes } from "./routes/portal-operating-hours";
import { portalChannelRoutes } from "./routes/portal-channels";
import { portalMacroRoutes } from "./routes/portal-macros";
import { portalWorkflowRoutes } from "./routes/portal-workflows";
import { portalSlaRoutes } from "./routes/portal-sla";
import { portalChatPageRoutes } from "./routes/portal-chat-page";
import { portalTranslationRoutes } from "./routes/portal-translations";
import { portalSettingsConsistencyRoutes } from "./routes/portal-settings-consistency";
import { promoCodesRoutes } from "./routes/promo-codes";
import { emailRoutes } from "./routes/emails";
import { organizationSettingsRoutes } from "./routes/organization-settings";
import { waitlistRoutes } from "./routes/waitlist";
import { embedRoutes } from "./routes/embed";
import { landingWidgetRoutes } from "./routes/landing-widget";
import { upsertVisitor } from "./utils/visitor";
import { requestContextPlugin } from "./plugins/request-context";
import { metricsTracker } from "./utils/metrics";
import { createRateLimitMiddleware } from "./middleware/rate-limit";
import { getRealIP } from "./utils/get-real-ip";
import { validateOrgKey, validateVisitorId, validateJsonContentType, validateMessageContent } from "./middleware/validation";
import { validateDomainAllowlist } from "./middleware/domain-allowlist";
import { requireOrgToken } from "./middleware/require-org-token";
import { isBillingWriteBlocked } from "./utils/billing-enforcement";
import { enforceWidgetBillingLock } from "./middleware/billing-lock";
import { RedisSessionStore } from "./utils/redis-session-store";
import { hostTrustPlugin } from "./middleware/host-trust";
import { securityHeadersPlugin } from "./middleware/security-headers";
import { buildCorsPolicy, isOriginAllowedByCorsPolicy } from "./middleware/cors-policy";
import { rateLimit } from "./middleware/rate-limiter";
import { verifyOrgToken } from "./utils/org-token";
import { extractDomain, isOriginAllowed } from "./utils/domain-validation";
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
import {
  generateAiResponse,
  parseAiConfig,
  isAiAvailable,
  checkAiQuota,
  incrementAiUsage,
  type ConversationMessage,
} from "./utils/ai-service";
import { checkAbandonedCheckouts } from "./jobs/checkAbandonedCheckouts";
import { prisma } from "./prisma";
import { verifyPortalSessionToken } from "./utils/portal-session";
import { getOperatingHoursStatus } from "./utils/operating-hours";
import { runWorkflowsForTrigger } from "./utils/workflow-engine";
import { sanitizeHTML } from "./utils/sanitize";
import { validateBody } from "./utils/validate";
import { widgetSendMessageSchema } from "./utils/schemas";
import { hashPassword } from "./utils/password";
import type {
  CreateConversationResponse,
  CreateMessageRequest,
  CreateMessageResponse,
  Conversation,
  ConversationDetail,
} from "./types";

type RealtimeSocket = Socket & {
  orgId?: string;
  orgKey?: string;
  isAgent?: boolean;
  portalUser?: unknown;
  visitorKey?: string;
};

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
const isProduction = process.env.NODE_ENV === "production";

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    // In production: plain JSON logs (lower CPU, better for log aggregators)
    // In development: pretty-printed for readability
    ...(isProduction
      ? {}
      : {
          transport: {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          },
        }),
  },
  bodyLimit: 32 * 1024, // 32KB max body size
  trustProxy: trustedProxies, // Only trust specific proxy IPs to prevent X-Forwarded-For spoofing
});

const globalApiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 200,
  message: "Too many requests, please slow down.",
  keyPrefix: "GLOBAL_HTTP",
  includeEndpointInKey: false,
  keyBuilder: (request) => getRealIP(request) || "unknown-ip",
});

const widgetConversationCreateRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: "Too many widget conversation requests",
  keyPrefix: "WIDGET_CONVERSATIONS_CREATE",
});

const widgetMessagesRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: "Too many widget message requests",
  keyPrefix: "WIDGET_MESSAGES_CREATE",
});

const widgetInitRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: "Too many widget init requests",
  keyPrefix: "WIDGET_INIT",
});

// Register plugins
const corsPolicy = buildCorsPolicy(process.env.NODE_ENV, [
  process.env.APP_PUBLIC_URL,
  process.env.NEXT_PUBLIC_WEB_URL,
  process.env.ALLOWED_ORIGINS,
  process.env.FRONTEND_URL,
  // Railway production frontend — hardcoded fallback
  "https://gracious-expression-production-7caa.up.railway.app",
  // Helvion landing origins
  "https://helvion.io",
  "https://www.helvion.io",
  "https://helvion-landing.pages.dev",
]);
let corsWarned = false;
let corsWildcardWarned = false;

fastify.register(cors, {
  origin: (origin, cb) => {
    if (corsPolicy.corsHasWildcard && !corsWildcardWarned) {
      corsWildcardWarned = true;
      fastify.log.warn("Wildcard entries in CORS allowlist are ignored for security.");
    }

    if (corsPolicy.isProduction && !corsPolicy.hasCorsAllowlist) {
      if (!corsWarned) {
        corsWarned = true;
        fastify.log.warn("CORS allowlist is empty in production. Blocking all cross-origin requests.");
      }
    }

    return cb(null, isOriginAllowedByCorsPolicy(origin, corsPolicy));
  },
  credentials: true, // Allow cookies in CORS requests
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-internal-key", "x-org-key"],
  exposedHeaders: ["retry-after", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "x-request-id", "x-helvino-portal-cookie-samesite", "x-helvino-portal-cookie-secure"],
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

// CSRF mitigation for cookie-authenticated routes:
// - CORS does NOT stop classic form-post CSRF (it only protects XHR/fetch).
// - Browsers include Origin on cross-site POST/PUT/PATCH/DELETE; we validate it
//   against the same allowlist used for CORS.
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
fastify.addHook("onRequest", async (request, reply) => {
  if (!UNSAFE_METHODS.has(request.method)) return;
  const origin = request.headers.origin as string | undefined;
  if (!origin) return;
  const cookieHeader = request.headers.cookie as string | undefined;
  if (!cookieHeader) return; // only relevant for cookie-authenticated requests

  const url = request.raw.url || request.url;
  const isCookieAuthSurface =
    url.startsWith("/portal") ||
    url.startsWith("/api/portal") ||
    url.startsWith("/internal");
  if (!isCookieAuthSurface) return;

  if (!isOriginAllowedByCorsPolicy(origin, corsPolicy)) {
    reply.code(403);
    return reply.send({
      error: {
        code: "CSRF_ORIGIN_BLOCKED",
        message: "Invalid Origin for authenticated request",
      },
    });
  }
});


fastify.register(requestContextPlugin);
fastify.register(hostTrustPlugin);
fastify.register(helmet, {
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://api.fontshare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.fontshare.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      // Explicitly close directives that have no fallback to default-src
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      workerSrc: ["'self'"],
    },
  },
  frameguard: { action: "deny" },
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});
fastify.register(securityHeadersPlugin);

fastify.addHook("preHandler", async (request, reply) => {
  if ((request.routeOptions?.config as { skipGlobalRateLimit?: boolean } | undefined)?.skipGlobalRateLimit) {
    return;
  }
  return globalApiRateLimit(request, reply);
});

// Force HTTPS in production when behind a proxy/load balancer.
fastify.addHook("onRequest", async (request, reply) => {
  if (!isProduction) return;
  const protoHeader = request.headers["x-forwarded-proto"];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  if (proto && proto !== "https") {
    const host = request.headers.host;
    if (!host) return;
    return reply.redirect(`https://${host}${request.raw.url}`, 301);
  }
});
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
fastify.register(analyticsRoutes); // Usage analytics + CSV export (portal auth)
fastify.register(adminOrgDirectoryRoutes); // Admin org directory (Step 11.39)
fastify.register(portalWidgetConfigRoutes); // Portal widget config + domains (Step 11.40)
fastify.register(portalAiConfigRoutes);    // Portal AI configuration
fastify.register(portalWidgetSettingsRoutes); // Portal widget appearance settings (Step 11.52)
fastify.register(portalDashboardRoutes);   // Portal dashboard (visitors, stats)
fastify.register(portalAiInboxRoutes);     // Portal AI inbox (suggest, summarize, translate)
fastify.register(auditLogRoutes); // Audit log routes: portal + admin (Step 11.42)
fastify.register(portalNotificationRoutes); // Portal notifications (Step 11.43)
fastify.register(portalOperatingHoursRoutes); // Portal settings: operating hours
fastify.register(portalChannelRoutes); // Portal settings: channels
fastify.register(portalMacroRoutes); // Portal settings: macros
fastify.register(portalWorkflowRoutes); // Portal settings: workflows
fastify.register(portalSlaRoutes); // Portal settings: SLA
fastify.register(portalChatPageRoutes); // Portal settings: chat page
fastify.register(portalTranslationRoutes); // Portal settings: translation overrides
fastify.register(portalSettingsConsistencyRoutes); // Portal settings: consistency guards
fastify.register(promoCodesRoutes, { prefix: "/api/promo-codes" }); // Promo code API
fastify.register(emailRoutes, { prefix: "/emails" }); // Email previews
fastify.register(organizationSettingsRoutes); // Organization-level toggles
fastify.register(waitlistRoutes); // Public waitlist
fastify.register(embedRoutes); // Widget embed.js (public)
fastify.register(landingWidgetRoutes); // Landing widget config (admin + public)

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
    widgetConversationCreateRateLimit,
    createRateLimitMiddleware({ limit: 30, windowMs: 60000 }), // 30 per minute
    requireOrgToken, // Require valid org token (or internal bypass)
    enforceWidgetBillingLock,
    validateVisitorId,
    validateJsonContentType,
    validateDomainAllowlist(), // Widget endpoint: enforce domain allowlist
  ],
  config: {
    skipGlobalRateLimit: true,
  },
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
      const clientIp = getRealIP(request);
      const visitor = await upsertVisitor(org.id, visitorKey, {
        userAgent,
        ip: clientIp || undefined,
        currentPage: request.headers["referer"] as string || undefined,
      });
      visitorId = visitor.id;
    } catch (error) {
      console.error("Failed to upsert visitor:", error);
      // Continue without visitor (backward compatible)
    }
  }

  const conversation = await store.createConversation(org.id, visitorId);
  await recordConversationUsage(org.id);
  runWorkflowsForTrigger("conversation_created", {
    orgId: org.id,
    conversationId: conversation.id,
  }).catch(() => {});
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
  Querystring: { limit?: string };
}>("/conversations", {
  preHandler: [
    widgetInitRateLimit,
    createRateLimitMiddleware({ limit: 120, windowMs: 60000 }), // 120 per minute
    validateOrgKey,
    validateDomainAllowlist(), // Widget endpoint: enforce domain allowlist
  ],
  config: {
    skipGlobalRateLimit: true,
  },
}, async (request, reply) => {
  const orgKey = request.headers["x-org-key"] as string;
  const rawLimit = request.query?.limit;
  const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : 50;
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 10), 100)
    : 50;

  if (!orgKey) {
    reply.code(401);
    return { error: "Missing x-org-key header" };
  }

  const org = await store.getOrganizationByKey(orgKey);
  if (!org) {
    reply.code(401);
    return { error: "Invalid organization key" };
  }

  return await store.listConversations(org.id, limit);
});

// Get conversation detail with messages
fastify.get<{
  Params: { id: string };
  Reply: ConversationDetail | { error: string };
}>("/conversations/:id", {
  preHandler: [
    createRateLimitMiddleware({ limit: 120, windowMs: 60000 }), // 120 per minute
    validateOrgKey,
    validateDomainAllowlist(), // Widget endpoint: enforce domain allowlist
  ],
}, async (request, reply) => {
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
    widgetMessagesRateLimit,
    createRateLimitMiddleware({ limit: 120, windowMs: 60000 }), // 120 per minute
    requireOrgToken, // Require valid org token (or internal bypass)
    enforceWidgetBillingLock,
    validateVisitorId,
    validateJsonContentType,
    validateMessageContent,
    validateDomainAllowlist(), // Widget endpoint: enforce domain allowlist
  ],
  config: {
    skipGlobalRateLimit: true,
  },
}, async (request, reply) => {
  const { id } = request.params;
  const parsedBody = validateBody(widgetSendMessageSchema, request.body, reply);
  if (!parsedBody) return;
  const { role, content } = parsedBody;
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

  const sanitizedContent = sanitizeHTML(content).trim();
  if (!sanitizedContent) {
    reply.code(400);
    return { error: "Message content is required" };
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

  const message = await store.addMessage(id, org.id, role, sanitizedContent);

  if (!message) {
    reply.code(404);
    return { error: "Conversation not found" };
  }

  // SECURITY:
  // - Agents should receive all messages for the org inbox.
  // - Widgets should only receive assistant messages (their own user message is already returned by HTTP).
  fastify.io.to(`org:${org.id}:agents`).emit("message:new", { conversationId: id, message });
  if (role !== "user") {
    fastify.io.to(`conv:${id}`).emit("message:new", { conversationId: id, message });
  }

  await recordMessageUsage(org.id);
  if (role === "assistant") {
    recordM2Usage(org.id).catch(() => {});
  }
  if (role === "user") {
    runWorkflowsForTrigger("message_created", {
      orgId: org.id,
      conversationId: id,
      actorRole: "user",
    }).catch(() => {});
  }

  // ── AI Auto-Reply: generate AI response when user sends a message ──
  if (role === "user" && org.aiEnabled && isAiAvailable()) {
    // Fire-and-forget: don't block the user's request
    (async () => {
      try {
        // Check AI quota before generating response
        const quota = await checkAiQuota(org.id);
        if (quota.exceeded) {
          console.warn(`[AI] Quota exceeded for org ${org.id}: ${quota.used}/${quota.limit}`);
          return;
        }

        // Check M2 entitlement before generating AI response
        const m2Check = await checkM2Entitlement(org.id);
        if (!m2Check.allowed) return;

        // Load org AI config from database
        const orgRecord = await prisma.organization.findUnique({
          where: { id: org.id },
          select: { aiConfigJson: true, aiProvider: true, language: true },
        });
        const aiConfig = parseAiConfig(orgRecord?.aiConfigJson);
        if (!aiConfig.autoReplyEnabled) return;

        // Override provider from org setting
        if (orgRecord?.aiProvider) {
          aiConfig.provider = orgRecord.aiProvider as "openai" | "gemini" | "claude";
        }

        // Emit typing indicator only to the visitor's conversation room.
        fastify.io.to(`conv:${id}`).emit("agent:typing", { conversationId: id, isAI: true });

        // Load recent conversation history (last 20 messages) for context
        const recentMessages = await store.getMessages(id);
        const history: ConversationMessage[] = recentMessages.slice(-20).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        // Generate AI response (multi-provider with fallback chain)
        const result = await generateAiResponse(history, {
          ...aiConfig,
          language: aiConfig.language || orgRecord?.language || "en",
        });

        if (!result.ok) {
          console.warn(`[AI] Generation failed for org ${org.id}:`, result.error);

          // Graceful fallback: send configured fallback message instead of dropping the reply.
          const fallbackText = (aiConfig.fallbackMessage || "").trim();
          if (fallbackText) {
            const fallbackMessage = await store.addMessage(id, org.id, "assistant", sanitizeHTML(fallbackText));
            if (fallbackMessage) {
              fastify.io.to(`org:${org.id}:agents`).emit("message:new", { conversationId: id, message: fallbackMessage });
              fastify.io.to(`conv:${id}`).emit("message:new", { conversationId: id, message: fallbackMessage });
            }
          }

          fastify.io.to(`conv:${id}`).emit("agent:typing:stop", { conversationId: id });
          return;
        }

        // Store AI response with tracking metadata
        const aiMessage = await store.addMessage(id, org.id, "assistant", sanitizeHTML(result.content), {
          provider: result.provider,
          model: result.model,
          tokensUsed: result.tokensUsed,
          cost: result.cost,
          responseTimeMs: result.responseTimeMs,
        });
        if (!aiMessage) return;

        // Stop typing indicator
        fastify.io.to(`conv:${id}`).emit("agent:typing:stop", { conversationId: id });

        // Emit to agents + visitor conversation
        fastify.io.to(`org:${org.id}:agents`).emit("message:new", { conversationId: id, message: aiMessage });
        fastify.io.to(`conv:${id}`).emit("message:new", { conversationId: id, message: aiMessage });

        // Record M2 usage + increment AI quota counter
        await recordM2Usage(org.id);
        await incrementAiUsage(org.id);
      } catch (err) {
        console.error("[AI] Auto-reply error:", err);
        // Stop typing on error too
        fastify.io.to(`conv:${id}`).emit("agent:typing:stop", { conversationId: id });
      }
    })();
  }

  // Off-hours fallback auto-reply (if enabled in settings)
  if (role === "user") {
    const hoursStatus = await getOperatingHoursStatus(org.id);
    if (!hoursStatus.withinHours && hoursStatus.offHoursAutoReply && hoursStatus.offHoursReplyText) {
      const offHoursMessage = await store.addMessage(
        id,
        org.id,
        "assistant",
        sanitizeHTML(hoursStatus.offHoursReplyText)
      );
      if (offHoursMessage) {
        fastify.io.to(`org:${org.id}:agents`).emit("message:new", { conversationId: id, message: offHoursMessage });
        fastify.io.to(`conv:${id}`).emit("message:new", { conversationId: id, message: offHoursMessage });
      }
    }
  }

  reply.code(201);
  return message;
});

// ── Request AI Help: manually trigger AI response for a conversation ──
fastify.post<{ Params: { conversationId: string } }>(
  "/conversations/:conversationId/ai-help",
  {
    preHandler: [
      createRateLimitMiddleware({ limit: 10, windowMs: 60000 }), // 10 per minute
      requireOrgToken,
      validateDomainAllowlist(), // Widget endpoint: enforce domain allowlist
    ],
  },
  async (request, reply) => {
    const org = request.org!;
    const { conversationId } = request.params;

    if (!org.aiEnabled || !isAiAvailable()) {
      reply.code(503);
      return { error: "AI not available" };
    }

    const quota = await checkAiQuota(org.id);
    if (quota.exceeded) {
      reply.code(402);
      return { error: "AI quota exceeded", code: "QUOTA_EXCEEDED" };
    }

    // Check M2 entitlement (AI assist metering)
    const m2Check = await checkM2Entitlement(org.id);
    if (!m2Check.allowed) {
      reply.code(402);
      return { error: m2Check.error || "AI quota exceeded", code: m2Check.code || "QUOTA_M2_EXCEEDED" };
    }

    // Load AI config
    const orgRecord = await prisma.organization.findUnique({
      where: { id: org.id },
      select: { aiConfigJson: true, aiProvider: true, language: true },
    });
    const aiConfig = parseAiConfig(orgRecord?.aiConfigJson);
    if (orgRecord?.aiProvider) {
      aiConfig.provider = orgRecord.aiProvider as "openai" | "gemini" | "claude";
    }

    // Emit typing to visitor conversation only
    fastify.io.to(`conv:${conversationId}`).emit("agent:typing", { conversationId, isAI: true });

    // Load conversation history
    const recentMessages = await store.getMessages(conversationId);
    const history: ConversationMessage[] = recentMessages.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const result = await generateAiResponse(history, {
      ...aiConfig,
      language: aiConfig.language || orgRecord?.language || "en",
    });

    if (!result.ok) {
      fastify.io.to(`conv:${conversationId}`).emit("agent:typing:stop", { conversationId });
      if (result.code === "RATE_LIMITED") {
        reply.code(429);
        return { error: result.error, code: "RATE_LIMITED" };
      }
      if (result.code === "QUOTA_EXCEEDED") {
        reply.code(402);
        return { error: result.error, code: "QUOTA_EXCEEDED" };
      }
      reply.code(500);
      // SECURITY: never leak internal provider error details to the client
      return { error: "AI service encountered an error", code: result.code || "AI_ERROR" };
    }

    // SECURITY: Sanitize AI-generated content before persisting (prevent stored XSS)
    const aiMessage = await store.addMessage(conversationId, org.id, "assistant", sanitizeHTML(result.content), {
      provider: result.provider,
      model: result.model,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      responseTimeMs: result.responseTimeMs,
    });

    fastify.io.to(`conv:${conversationId}`).emit("agent:typing:stop", { conversationId });

    if (aiMessage) {
      fastify.io.to(`org:${org.id}:agents`).emit("message:new", { conversationId, message: aiMessage });
      fastify.io.to(`conv:${conversationId}`).emit("message:new", { conversationId, message: aiMessage });
      await recordM2Usage(org.id);
      await incrementAiUsage(org.id);
    }

    return { ok: true, message: aiMessage };
  }
);

// Socket.IO connection handlers with org-based rooms
fastify.ready().then(() => {
  // ─────────────────────────────────────────────────────────────
  // Socket.IO security model:
  // - Two logical clients share one namespace:
  //   - Portal agents: authenticated via portal session token (JWT-like).
  //   - Widget visitors: authenticated via short-lived orgToken + visitorKey.
  // - Server-side rooms enforce isolation:
  //   - org:<orgId>:agents   → only agents (inbox updates, visitor typing)
  //   - org:<orgId>:widgets  → only widgets (config updates, org-level widget events)
  //   - conv:<conversationId> → only the single widget visitor conversation
  // ─────────────────────────────────────────────────────────────

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

  async function validateWidgetConversationJoin(input: {
    orgId: string;
    visitorKey: string;
    conversationId: string;
  }): Promise<boolean> {
    const conversation = await prisma.conversation.findFirst({
      where: { id: input.conversationId, orgId: input.orgId },
      select: { id: true, visitorId: true },
    });
    if (!conversation?.visitorId) return false;

    const visitor = await prisma.visitor.findUnique({
      where: { orgId_visitorKey: { orgId: input.orgId, visitorKey: input.visitorKey } },
      select: { id: true },
    });
    if (!visitor) return false;
    return visitor.id === conversation.visitorId;
  }

  function createEventLimiter(params: { windowMs: number; max: number }) {
    let resetAt = 0;
    let count = 0;
    return () => {
      const now = Date.now();
      if (now > resetAt) {
        resetAt = now + params.windowMs;
        count = 0;
      }
      count += 1;
      return count <= params.max;
    };
  }

  // Socket.IO auth middleware
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
});

// ── Background Jobs ──
import { scheduleAiQuotaReset } from "./jobs/reset-ai-quota";

async function seedAdminUserOnStartup(): Promise<void> {
  const rawEmail = process.env.ADMIN_EMAIL;
  const rawPassword = process.env.ADMIN_PASSWORD;

  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (!email || !password) {
    // Don't block startup; just inform. Production should set these.
    console.warn("[admin-seed] ADMIN_EMAIL / ADMIN_PASSWORD not set; skipping admin seed");
    return;
  }

  try {
    const existing = await prisma.adminUser.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) return;

    const passwordHash = await hashPassword(password);
    await prisma.adminUser.create({
      data: { email, passwordHash, role: "owner" },
      select: { id: true },
    });

    // Requested log line (do not log password).
    console.log(`Admin user seeded: ${email}`);
  } catch (err) {
    // If multiple instances start concurrently, one may win the create.
    const code = err && typeof err === "object" && "code" in err ? (err as any).code : null;
    if (code === "P2002") return;
    console.error("[admin-seed] Failed to seed admin user:", err);
  }
}

// Start server
const start = async () => {
  try {
    // Railway production DB may not have admin user yet.
    // Ensure one exists before we start accepting requests.
    await seedAdminUserOnStartup();

    await fastify.listen({ port: PORT, host: HOST });
    console.log(`\n🚀 ${APP_NAME} API is running!`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API docs: http://localhost:${PORT}/`);
    console.log(`🔌 Socket.IO enabled on the same port\n`);

    // Start background jobs
    scheduleAiQuotaReset();
    // Check abandoned checkouts every minute.
    cron.schedule("* * * * *", async () => {
      try {
        await checkAbandonedCheckouts();
      } catch (error) {
        console.error("[checkout-abandoned] scheduler error:", error);
      }
    });
    console.log("[checkout-abandoned] Cron scheduled: every minute");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
