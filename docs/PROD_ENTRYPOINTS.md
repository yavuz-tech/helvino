Production entrypoints and protections

Public (widget)
- POST /conversations
  - Rate limit: 30/min per org+IP
  - Domain allowlist enforcement
  - JSON content type + message size validation
- POST /conversations/:id/messages
  - Rate limit: 120/min per org+IP
  - Domain allowlist enforcement
  - JSON content type + message size validation
- GET /conversations
  - Rate limit: 120/min per org+IP
  - Domain allowlist enforcement
- GET /conversations/:id
  - Rate limit: 120/min per org+IP
  - Domain allowlist enforcement
- POST /conversations/:conversationId/ai-help
  - Rate limit: 10/min per org+IP
  - Domain allowlist enforcement
  - AI quota checks

Portal (customer panel)
- /portal/* endpoints require authenticated portal user
- Key routes (examples):
  - GET /portal/conversations (60/min per user+IP)
  - POST /portal/conversations/:id/messages (60/min per user+IP)
  - AI routes under /portal/conversations/:id/ai-*

Admin
- /admin/* and internal routes require admin session + MFA where applicable

Global protections
- API security headers via middleware/security-headers.ts
- Trust proxy restricted to configured IPs (TRUSTED_PROXIES)
- 32KB request body limit at Fastify level

