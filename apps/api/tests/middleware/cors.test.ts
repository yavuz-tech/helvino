import { describe, expect, it } from "vitest";
import { buildCorsPolicy, isOriginAllowedByCorsPolicy } from "../../src/middleware/cors-policy";

describe("cors policy", () => {
  it("blocks all origins in production when allowlist is empty", () => {
    const policy = buildCorsPolicy("production", []);
    const allowed = isOriginAllowedByCorsPolicy("https://example.com", policy);
    expect(allowed).toBe(false);
  });

  it("allows localhost in development when allowlist is empty", () => {
    const policy = buildCorsPolicy("development", []);
    const localhostAllowed = isOriginAllowedByCorsPolicy("http://localhost:3000", policy);
    const remoteBlocked = isOriginAllowedByCorsPolicy("https://example.com", policy);

    expect(localhostAllowed).toBe(true);
    expect(remoteBlocked).toBe(false);
  });

  it("rejects wildcard allowlist entries", () => {
    const policy = buildCorsPolicy("production", ["*"]);
    const allowed = isOriginAllowedByCorsPolicy("https://evil.com", policy);

    expect(policy.corsHasWildcard).toBe(true);
    expect(policy.hasCorsAllowlist).toBe(false);
    expect(allowed).toBe(false);
  });

  it("allows valid domain in allowlist", () => {
    const policy = buildCorsPolicy("production", ["https://app.helvion.com"]);
    const allowed = isOriginAllowedByCorsPolicy("https://app.helvion.com", policy);
    expect(allowed).toBe(true);
  });
});
