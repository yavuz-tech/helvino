import { Suspense } from "react";
import PortalInboxContent from "./PortalInboxContent";

export default function PortalInboxPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center"><div className="text-[#475569]">Loading...</div></div>}>
      <PortalInboxContent />
    </Suspense>
  );
}
