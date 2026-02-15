import { Suspense } from "react";
import PortalInboxContent from "./PortalInboxContent";
import LoadingFallback from "@/components/LoadingFallback";

export default function PortalInboxPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PortalInboxContent />
    </Suspense>
  );
}
