import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../src/utils/password";

describe("Password Utils", () => {
  it("should hash and verify password correctly", async () => {
    const password = "TestPassword123!";
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);

    const isValid = await verifyPassword(hash, password);
    expect(isValid).toBe(true);
  });

  it("should reject wrong password", async () => {
    const hash = await hashPassword("CorrectPassword");
    const isValid = await verifyPassword(hash, "WrongPassword");
    expect(isValid).toBe(false);
  });

  it("should generate unique hashes", async () => {
    const hash1 = await hashPassword("SamePassword");
    const hash2 = await hashPassword("SamePassword");
    expect(hash1).not.toBe(hash2);
  });
});
