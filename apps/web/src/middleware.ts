import { NextResponse, type NextRequest } from "next/server";

const ADMIN_HOST = "admin-agent.zodo.ca";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] ?? "";
  const path = request.nextUrl.pathname;
  const isAdminPath = path === "/admin" || path.startsWith("/admin/") || path === "/admin-login";
  const isAdminHost = host === ADMIN_HOST || host === "localhost";

  if (host === ADMIN_HOST && !isAdminPath) {
    return NextResponse.redirect(
      publicUrl(request, path === "/login" ? "/admin-login" : "/admin"),
    );
  }

  if (isAdminPath && !isAdminHost) {
    return NextResponse.redirect(publicUrl(request, "/forbidden"));
  }

  return NextResponse.next();
}

function publicUrl(request: NextRequest, path: string) {
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  return new URL(path, `${forwardedProto}://${forwardedHost}`);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\..*).*)"],
};
