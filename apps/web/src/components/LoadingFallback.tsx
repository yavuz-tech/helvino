/**
 * LoadingFallback — language-neutral loading indicator for Suspense boundaries.
 *
 * Uses a CSS spinner instead of text so it works correctly before i18n
 * initializes. Can be used as `<Suspense fallback={<LoadingFallback />}>`.
 */
export default function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-amber-500 animate-spin" />
    </div>
  );
}
