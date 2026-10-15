import { NextResponse, type NextRequest } from "next/server";
import { readSessionToken } from "./lib/session";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/templates") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const session = await readSessionToken(req.cookies.get("tlm_session")?.value);

  if (PUBLIC_PATHS.has(pathname)) {
    if (session && pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    return NextResponse.redirect(login);
  }

  const adminOnly = pathname === "/users" || pathname.startsWith("/api/users");
  if (adminOnly && session.role !== "admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
