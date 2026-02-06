import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /dashboard routes
  if (pathname.startsWith("/dashboard")) {
    // Check if user is authenticated by verifying session exists
    // The session cookie will be sent with the request
    // We need to verify it with the API
    
    // For now, we'll handle auth check client-side in the dashboard page
    // since middleware can't easily make async API calls with cookies
    
    // This middleware is primarily for future enhancement
    // The actual auth check happens in the dashboard page itself
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
