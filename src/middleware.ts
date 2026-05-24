import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Allow /login and /api routes without auth
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // All other routes will be handled by layout auth checks
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - public (images, favicons, etc.)
     * - _next (Next.js internals)
     * - api (except we handle it above)
     */
    "/((?!public|_next|.*\\.js).*)",
  ],
};
