import { APP_NAME } from "@helvino/shared";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-900 mb-4">
          {APP_NAME}
        </h1>
        <p className="text-xl text-slate-600 mb-8">
          AI-Powered Chat Solutions
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">System Operational</span>
        </div>
      </div>
    </main>
  );
}
