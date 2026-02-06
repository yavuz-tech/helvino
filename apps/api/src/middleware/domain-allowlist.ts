/**
 * Domain Allowlist Middleware
 * 
 * Validates Origin/Referer headers against organization's allowed domains
 * Protects widget-related endpoints from unauthorized domain usage
 * 
 * Supports both siteId (preferred) and orgKey (legacy) for organization lookup
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../prisma";
import { isOriginAllowed, extractDomain, isLocalhost } from "../utils/domain-validation";

/**
 * Domain allowlist middleware
 * 
 * Validates Origin or Referer header against org's allowedDomains
 * Supports wildcard patterns (*.domain.com) and localhost handling
 */
export function validateDomainAllowlist() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Get organization identifier from headers (siteId preferred, orgKey legacy)
    const siteId = request.headers["x-site-id"] as string | undefined;
    const orgKey = request.headers["x-org-key"] as string | undefined;

    // Must have either siteId or orgKey to proceed
    if (!siteId && !orgKey) {
      // This endpoint requires organization identification
      reply.code(400);
      return reply.send({ error: "siteId or orgKey required" });
    }

    // Load organization from database
    const org = await prisma.organization.findUnique({
      where: siteId ? { siteId } : { key: orgKey },
      select: {
        id: true,
        key: true,
        siteId: true,
        name: true,
        allowedDomains: true,
        allowLocalhost: true,
      },
    });

    if (!org) {
      reply.code(404);
      return reply.send({ error: "Organization not found" });
    }

    // Get Origin or Referer header
    const origin = request.headers.origin as string | undefined;
    const referer = request.headers.referer as string | undefined;
    const requestOrigin = origin || referer;

    // If no Origin/Referer header present
    if (!requestOrigin) {
      // For development/testing (curl, local scripts):
      // Allow if allowLocalhost is true OR if request IP is localhost
      const isLocalhostIP = 
        request.ip === "127.0.0.1" || 
        request.ip === "::1" || 
        request.ip === "::ffff:127.0.0.1";

      if (org.allowLocalhost || isLocalhostIP) {
        request.log.info(
          { orgId: org.id, ip: request.ip, allowLocalhost: org.allowLocalhost },
          "No Origin/Referer but request from localhost/dev, allowing (curl/testing)"
        );
        return;
      }

      // For production: require Origin/Referer
      request.log.warn(
        { orgId: org.id, method: request.method, url: request.url, ip: request.ip },
        "No Origin/Referer header present, rejecting request"
      );

      reply.code(403);
      return reply.send({
        error: "Missing Origin or Referer header",
        message: "Widget requests must include Origin or Referer header",
      });
    }

    // Validate origin against allowlist
    if (!isOriginAllowed(requestOrigin, org.allowedDomains, org.allowLocalhost)) {
      const domain = extractDomain(requestOrigin);

      request.log.warn(
        {
          orgId: org.id,
          siteId: org.siteId,
          domain,
          allowedDomains: org.allowedDomains,
          allowLocalhost: org.allowLocalhost,
          origin,
          referer,
          ip: request.ip,
        },
        "Domain not in allowlist, rejecting request"
      );

      reply.code(403);
      return reply.send({
        error: "Domain not allowed",
        message: `The domain '${domain}' is not authorized to use this widget`,
        hint: "Contact your administrator to add this domain to the allowlist",
      });
    }

    // Domain is allowed, continue
    const domain = extractDomain(requestOrigin);
    request.log.info(
      { orgId: org.id, siteId: org.siteId, domain, allowedDomains: org.allowedDomains },
      "Domain allowlist check passed"
    );
  };
}
