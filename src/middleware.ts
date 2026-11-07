import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/jwt";

/**
 * Edge middleware that keeps unauthenticated visitors out of the application
 * shell and keeps signed-in staff away from the login screen. Page-level and
 * action-level guards still run; this is the first line, not the only one.
 */
const PUBLIC_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!session && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (session && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on every route except Next.js internals, the health endpoint and
     * static assets.
     */
    "/((?!_next/static|_next/image|api/health|favicon.ico|icon.svg|apple-icon.png|robots.txt|sitemap.xml).*)",
  ],
};
