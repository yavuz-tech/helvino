import { Suspense } from "react";
import PortalInboxContent from "./PortalInboxContent";

export default function PortalInboxPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="text-slate-600">Loading...</div></div>}>
      <PortalInboxContent />
    </Suspense>
  );
}
