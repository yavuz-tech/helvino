/**
 * Request Validation Middleware
 * 
 * Validates headers, body size, and content types
 */

import { FastifyRequest, FastifyReply } from "fastify";

/**
 * Validate x-org-key header
 */
export async function validateOrgKey(request: FastifyRequest, reply: FastifyReply) {
  const orgKey = request.headers["x-org-key"] as string;

  if (!orgKey) {
    reply.code(400);
    return reply.send({ error: "Missing x-org-key header" });
  }

  if (orgKey.length > 64) {
    reply.code(400);
    return reply.send({ error: "x-org-key exceeds maximum length (64 characters)" });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(orgKey)) {
    reply.code(400);
    return reply.send({ error: "x-org-key contains invalid characters" });
  }
}

/**
 * Validate x-visitor-id header (optional, but if present must be valid)
 */
export async function validateVisitorId(request: FastifyRequest, reply: FastifyReply) {
  const visitorId = request.headers["x-visitor-id"] as string | undefined;

  if (!visitorId) {
    return; // Optional header
  }

  if (!visitorId.startsWith("v_")) {
    reply.code(400);
    return reply.send({ error: "x-visitor-id must start with 'v_'" });
  }

  if (visitorId.length > 80) {
    reply.code(400);
    return reply.send({ error: "x-visitor-id exceeds maximum length (80 characters)" });
  }
}

/**
 * Validate JSON content type for POST requests
 */
export async function validateJsonContentType(request: FastifyRequest, reply: FastifyReply) {
  if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
    const contentType = request.headers["content-type"];
    
    if (!contentType || !contentType.includes("application/json")) {
      reply.code(400);
      return reply.send({ error: "Content-Type must be application/json" });
    }
  }
}

/**
 * Validate message content length
 */
export async function validateMessageContent(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as any;

  if (body && body.content) {
    if (typeof body.content !== "string") {
      reply.code(400);
      return reply.send({ error: "Message content must be a string" });
    }

    // 32KB limit for message content
    const contentSize = Buffer.byteLength(body.content, "utf8");
    if (contentSize > 32 * 1024) {
      reply.code(400);
      return reply.send({ 
        error: "Message content exceeds maximum size (32KB)",
        currentSize: contentSize,
        maxSize: 32 * 1024,
      });
    }
  }
}

/**
 * Validate widget branding fields
 */
export function validateWidgetBranding(data: any): { valid: boolean; error?: string } {
  // Validate widgetName
  if (data.widgetName !== undefined) {
    if (typeof data.widgetName !== "string") {
      return { valid: false, error: "widgetName must be a string" };
    }
    if (data.widgetName.length > 64) {
      return { valid: false, error: "widgetName exceeds maximum length (64 characters)" };
    }
    if (data.widgetName.trim().length === 0) {
      return { valid: false, error: "widgetName cannot be empty" };
    }
  }

  // Validate widgetSubtitle
  if (data.widgetSubtitle !== undefined) {
    if (typeof data.widgetSubtitle !== "string") {
      return { valid: false, error: "widgetSubtitle must be a string" };
    }
    if (data.widgetSubtitle.length > 80) {
      return { valid: false, error: "widgetSubtitle exceeds maximum length (80 characters)" };
    }
  }

  // Validate language
  if (data.language !== undefined) {
    const validLanguages = ["en", "tr", "de", "fr", "es"];
    if (!validLanguages.includes(data.language)) {
      return { 
        valid: false, 
        error: `language must be one of: ${validLanguages.join(", ")}` 
      };
    }
  }

  // Validate primaryColor
  if (data.primaryColor !== undefined) {
    if (typeof data.primaryColor !== "string") {
      return { valid: false, error: "primaryColor must be a string" };
    }
    // Must be valid hex color: #RRGGBB
    if (!/^#[0-9A-Fa-f]{6}$/.test(data.primaryColor)) {
      return { valid: false, error: "primaryColor must be a valid hex color (e.g., #0F5C5C)" };
    }
  }

  // Validate position
  if (data.position !== undefined) {
    if (data.position !== "right" && data.position !== "left") {
      return { valid: false, error: 'position must be "right" or "left"' };
    }
  }

  return { valid: true };
}
