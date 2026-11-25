import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/register"];
const COOKIE = "nexus_session";

/** Fast, cookie-presence-only gate. Real validation happens in the API on every request. */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(COOKIE);
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));
  if (!hasSession && !isPublic) {
    const url = new URL("/login", request.url);
    if (pathname !== "/" && pathname !== "/dashboard") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  // Logged-in users visiting /login are redirected client-side after the session is verified,
  // so a stale cookie can never cause a redirect loop.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp)$).*)"],
};
