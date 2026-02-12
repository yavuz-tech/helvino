import { describe, it, expect, beforeAll } from "vitest";

type OrgTokenModule = typeof import("../../src/utils/org-token");
let orgTokenModule: OrgTokenModule;

describe("Org Token Utils", () => {
  beforeAll(async () => {
    process.env.ORG_TOKEN_SECRET = process.env.ORG_TOKEN_SECRET || "test-secret-for-ci";
    orgTokenModule = await import("../../src/utils/org-token");
  });

  it("should create and verify a valid token", () => {
    const payload = { orgId: "test-org-123", orgKey: "demo" };
    const token = orgTokenModule.createOrgToken(payload);

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const verified = orgTokenModule.verifyOrgToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.orgId).toBe(payload.orgId);
    expect(verified?.orgKey).toBe(payload.orgKey);
  });

  it("should reject tampered token", () => {
    const payload = { orgId: "test-org-123", orgKey: "demo" };
    const token = orgTokenModule.createOrgToken(payload);
    const tampered = `${token}x`;

    const result = orgTokenModule.verifyOrgToken(tampered);
    expect(result).toBeNull();
  });
});
