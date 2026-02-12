import { describe, expect, it } from "vitest";
import { validatePasswordStrength } from "../../src/utils/password";

describe("validatePasswordStrength", () => {
  it("accepts 8+ char password with uppercase/lowercase/number/special", () => {
    const result = validatePasswordStrength("GoodPass1!");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects 7 character password", () => {
    const result = validatePasswordStrength("Aa1!abc");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("minimum_length");
  });

  it("rejects missing uppercase", () => {
    const result = validatePasswordStrength("lowercase1!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("uppercase");
  });

  it("rejects missing lowercase", () => {
    const result = validatePasswordStrength("UPPERCASE1!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("lowercase");
  });

  it("rejects missing number", () => {
    const result = validatePasswordStrength("NoNumber!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("number");
  });

  it("rejects missing special character", () => {
    const result = validatePasswordStrength("NoSpecial1");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("special");
  });

  it("rejects empty string", () => {
    const result = validatePasswordStrength("");
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining(["minimum_length", "uppercase", "lowercase", "number", "special"])
    );
  });

  it("accepts very strong password", () => {
    const result = validatePasswordStrength("T0p!Tier#Password$2026");
    expect(result.valid).toBe(true);
  });
});
