import { describe, it, expect } from "vitest";
import { getMeteringLimitsForPlan } from "../../src/utils/entitlements";

describe("Plan Entitlements", () => {
  it("should have lower limits for free plan", () => {
    const free = getMeteringLimitsForPlan("free");
    const pro = getMeteringLimitsForPlan("pro");
    expect(free.m3LimitVisitorsPerMonth).toBeLessThan(pro.m3LimitVisitorsPerMonth as number);
  });

  it("should increase limits on pro plan", () => {
    const free = getMeteringLimitsForPlan("free");
    const pro = getMeteringLimitsForPlan("pro");
    expect(pro.m2LimitPerMonth).toBeGreaterThan(free.m2LimitPerMonth as number);
  });

  it("should have highest limits on business plan", () => {
    const pro = getMeteringLimitsForPlan("pro");
    const business = getMeteringLimitsForPlan("business");
    expect(business.m1LimitPerMonth).toBeGreaterThan(pro.m1LimitPerMonth as number);
  });
});
