import { describe, expect, it } from "vitest";
import { loginSchema, sendMessageSchema, signupSchema } from "../../src/utils/schemas";

describe("zod schemas", () => {
  it("loginSchema accepts valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "Secret123!",
    });
    expect(result.success).toBe(true);
  });

  it("loginSchema rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "Secret123!",
    });
    expect(result.success).toBe(false);
  });

  it("loginSchema rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("signupSchema accepts valid data", () => {
    const result = signupSchema.safeParse({
      email: "owner@company.com",
      password: "StrongPass123!",
      orgName: "Helvion",
    });
    expect(result.success).toBe(true);
  });

  it("signupSchema rejects short password", () => {
    const result = signupSchema.safeParse({
      email: "owner@company.com",
      password: "short1!",
      orgName: "Helvion",
    });
    expect(result.success).toBe(false);
  });

  it("signupSchema validates email format", () => {
    const result = signupSchema.safeParse({
      email: "owner-at-company.com",
      password: "StrongPass123!",
      orgName: "Helvion",
    });
    expect(result.success).toBe(false);
  });

  it("sendMessageSchema rejects empty content", () => {
    const result = sendMessageSchema.safeParse({
      content: "",
      type: "text",
    });
    expect(result.success).toBe(false);
  });

  it("sendMessageSchema rejects content longer than 10000 chars", () => {
    const result = sendMessageSchema.safeParse({
      content: "a".repeat(10001),
      type: "text",
    });
    expect(result.success).toBe(false);
  });
});
