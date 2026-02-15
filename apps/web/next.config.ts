import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@helvino/shared"],
  // Allow CI/verify builds to use a separate output dir so they don't
  // clobber the dev server's .next cache.
  ...(process.env.NEXT_BUILD_DIR ? { distDir: process.env.NEXT_BUILD_DIR } : {}),
  // Fix "multiple lockfiles" warning: pin monorepo root so Next.js doesn't
  // pick up package-lock.json from parent dirs (/Users/...)
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Suppress hydration mismatch overlay caused by browser extensions
  // (e.g. Dark Reader) injecting className/style on <html>
  devIndicators: false,
  // Skip ESLint during production builds (type safety enforced via tsc)
  eslint: { ignoreDuringBuilds: true },
  // Disable experimental features that might trigger pages router
  experimental: {},
  // SECURITY: Suppress X-Powered-By header to prevent framework fingerprinting
  poweredByHeader: false,
  // SECURITY: Explicitly disable source maps in production to prevent source code exposure
  productionBrowserSourceMaps: false,
};

export default nextConfig;
