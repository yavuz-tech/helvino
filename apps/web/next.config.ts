import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@helvino/shared"],
  // Allow CI/verify builds to use a separate output dir so they don't
  // clobber the dev server's .next cache.
  ...(process.env.NEXT_BUILD_DIR ? { distDir: process.env.NEXT_BUILD_DIR } : {}),
};

export default nextConfig;
