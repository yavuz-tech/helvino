import { FastifyRequest } from "fastify";

function readHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.trim().length > 0);
    return first ? first.trim() : null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function normalizeIp(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice("::ffff:".length);
  }
  return trimmed;
}

export function getRealIP(request: FastifyRequest): string {
  const cfIp = readHeader(request.headers["cf-connecting-ip"]);
  if (cfIp) return normalizeIp(cfIp);

  const forwarded = readHeader(request.headers["x-forwarded-for"]);
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }

  const xRealIp = readHeader(request.headers["x-real-ip"]);
  if (xRealIp) return normalizeIp(xRealIp);

  if (request.ip) return normalizeIp(request.ip);
  if (request.raw?.socket?.remoteAddress) return normalizeIp(request.raw.socket.remoteAddress);
  return "unknown";
}
