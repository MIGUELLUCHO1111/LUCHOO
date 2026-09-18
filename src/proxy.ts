import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const ADMIN_AGENT_ONLY_PREFIXES = [
  "/assets",
  "/software",
  "/maintenance",
  "/purchases",
  "/suppliers",
];

const ADMIN_ONLY_PREFIXES = ["/users"];

export default auth(function proxy(req) {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isLoginPage = nextUrl.pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  if (isLoggedIn) {
    const role = req.auth?.user?.role;
    const isStaffOnly = ADMIN_AGENT_ONLY_PREFIXES.some((p) => nextUrl.pathname.startsWith(p));
    const isAdminOnly = ADMIN_ONLY_PREFIXES.some((p) => nextUrl.pathname.startsWith(p));

    if (isStaffOnly && role === "REQUESTER") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    if (isAdminOnly && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
