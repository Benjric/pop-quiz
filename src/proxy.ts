import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Keeps the teacher pages behind the login. Student pages (/, /play) and the
 * API stay open here — API routes check the session or player cookie
 * themselves so they can answer with 401 instead of a redirect.
 */
const TEACHER_PREFIXES = ["/dashboard", "/host"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (pathname === "/login") {
    if (session) return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }

  if (TEACHER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
