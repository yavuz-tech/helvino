import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Middleware — Step 11.28 Security Headers
 *
 * Adds security headers to all responses:
 * - Admin/Portal pages: strong CSP with frame-ancestors 'none' (deny framing)
 * - Public/widget embed pages: looser CSP allowing framing
 * - Universal: Referrer-Policy, Permissions-Policy, X-Content-Type-Options, X-Frame-Options
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // ── Universal security headers ──
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  // ── Route-specific CSP ──
  const isDashboardOrPortal =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/login");

  if (isDashboardOrPortal) {
    // Admin/Portal: deny framing entirely
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:* https:; frame-ancestors 'none'"
    );
  } else {
    // Public / widget-embeddable pages: allow framing from any origin
    // (the widget bootloader needs to be embeddable)
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:* https:; frame-ancestors *"
    );
  }

  // ── Production-only: HSTS ──
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  return response;
}

export const config = {
  // Match all routes except static files and Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
