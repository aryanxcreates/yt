import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, AUTH_TOKEN } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const isAuthed = request.cookies.get(AUTH_COOKIE)?.value === AUTH_TOKEN;
  if (isAuthed) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Protect everything except the login page, the login API, and Next.js
    // internals / static assets (so the login screen itself can load).
    "/((?!login|api/login|_next/static|_next/image|favicon.ico).*)",
  ],
};
