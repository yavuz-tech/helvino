"use client";

import { usePortalAuth } from "@/contexts/PortalAuthContext";
import PricingPage from "./pricing-page";

export default function PortalPricingPage() {
  const { user, loading } = usePortalAuth();
  if (loading) return null;
  return <PricingPage planKey={user?.planKey || "free"} orgKey={user?.orgKey || ""} />;
}
