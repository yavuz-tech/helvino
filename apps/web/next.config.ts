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

  // SECURITY: Strip console.log/warn in production builds to reduce
  // information leakage (ZAP: "Suspicious Comments" finding).
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error"] }
      : false,
  },

  // SECURITY: Apply headers to static assets and paths that bypass
  // the Next.js middleware matcher (/_next/static, /_next/image, etc.).
  async headers() {
    return [
      {
        // All routes — baseline security headers
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
