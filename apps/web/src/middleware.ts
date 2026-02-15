import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Middleware — Security Headers (OWASP ZAP hardened)
 *
 * Adds security headers to ALL responses:
 *
 * CSP zones:
 *   1. Dashboard / Portal / Login — strong CSP, frame-ancestors 'none'
 *   2. Widget-embeddable routes    — CSP with frame-ancestors 'self' https:
 *   3. Everything else (landing)   — standard CSP, frame-ancestors 'self'
 *
 * Universal headers on every response:
 *   Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy,
 *   Permissions-Policy, X-Frame-Options
 *
 * CSP notes:
 *   - script-src 'unsafe-inline': REQUIRED by Next.js inline scripts.
 *     'strict-dynamic' is NOT used because Next.js App Router does not
 *     generate CSP nonces by default — adding 'strict-dynamic' causes
 *     CSP3 browsers to ignore 'self' and 'unsafe-inline', blocking ALL
 *     scripts and breaking the site entirely.
 *   - style-src 'unsafe-inline': REQUIRED by Next.js + Tailwind CSS
 *     for runtime-injected <style> blocks.  Cannot be removed without
 *     breaking the UI.
 *   - object-src, base-uri, form-action: explicitly set to prevent
 *     fallback gaps (ZAP: "Failure to Define Directive with No Fallback").
 */

/** Canonical domain; old invite/reset links may still point to helvino.io. */
const CANONICAL_HOST = "helvion.io";

// ── CSP building blocks ──

const CSP_COMMON_DIRECTIVES = [
  "default-src 'self'",
  "img-src 'self' data: https:",
  // Google Fonts (woff2) + Fontshare (woff2) + inline data: URIs
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.fontshare.com",
  // Next.js + Tailwind inject inline <style>; cannot remove 'unsafe-inline'.
  // Google Fonts + Fontshare serve CSS stylesheets that must be allowed.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
  // Block <object>, <embed>, <applet>
  "object-src 'none'",
  // Restrict <base> to same-origin
  "base-uri 'self'",
  // Restrict form submissions to same-origin
  "form-action 'self'",
  // Prevent the page from being used as a worker source
  "worker-src 'self' blob:",
  // Manifest
  "manifest-src 'self'",
];

function buildCsp(opts: {
  isProduction: boolean;
  frameAncestors: string;
}): string {
  const { isProduction, frameAncestors } = opts;

  // script-src: 'unsafe-inline' is required by Next.js inline scripts.
  // DO NOT add 'strict-dynamic' — Next.js App Router doesn't generate
  // CSP nonces, so 'strict-dynamic' causes CSP3 browsers to ignore
  // 'self' + 'unsafe-inline' and block ALL scripts (site goes blank).
  // Cloudflare Web Analytics (static.cloudflareinsights.com) is allowed explicitly.
  const scriptSrc = isProduction
    ? "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  // connect-src: In production, limit to HTTPS/WSS schemes.
  // 'self' covers same-origin; https:/wss: cover the external API + Stripe + analytics.
  const connectSrc = isProduction
    ? "connect-src 'self' https: wss:"
    : "connect-src 'self' http://localhost:* ws://localhost:* https: wss:";

  return [
    ...CSP_COMMON_DIRECTIVES,
    scriptSrc,
    connectSrc,
    `frame-ancestors ${frameAncestors}`,
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || request.nextUrl.hostname || "";
  const isProduction = process.env.NODE_ENV === "production";

  // Redirect legacy helvino.io → helvion.io (same path + query)
  if (host.replace(/:.*/, "") === "helvino.io") {
    const url = new URL(request.url);
    url.host = CANONICAL_HOST;
    url.protocol = "https:";
    return NextResponse.redirect(url.toString(), 301);
  }

  const response = NextResponse.next();

  // ── Universal security headers ──
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  // ── HSTS (all environments — browsers only honour it over HTTPS) ──
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );

  // ── Route zones ──
  const isDashboardOrPortal =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login");

  // Widget embed routes need to be frameable from customer domains
  const isWidgetEmbed =
    pathname.startsWith("/widget") || pathname.startsWith("/embed");

  if (isDashboardOrPortal) {
    // Zone 1: Authenticated pages — deny framing entirely
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set(
      "Content-Security-Policy",
      buildCsp({ isProduction, frameAncestors: "'none'" })
    );
    // Sensitive pages: prevent caching of authenticated content
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );
  } else if (isWidgetEmbed) {
    // Zone 2: Widget embed — must be frameable from customer HTTPS origins
    // (cannot restrict to specific domains; customers embed on their own sites)
    response.headers.delete("X-Frame-Options"); // frame-ancestors takes precedence
    response.headers.set(
      "Content-Security-Policy",
      buildCsp({ isProduction, frameAncestors: "'self' https:" })
    );
  } else {
    // Zone 3: Public / marketing pages
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    response.headers.set(
      "Content-Security-Policy",
      buildCsp({ isProduction, frameAncestors: "'self'" })
    );
  }

  return response;
}

export const config = {
  // Match all routes except static files and Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
