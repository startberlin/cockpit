import { get } from "@vercel/edge-config";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import {
  MAINTENANCE_BYPASS_COOKIE,
  maintenanceBypassSecret,
  safeRedirectPath,
} from "@/lib/maintenance";

const publicRoutes = ["/auth"];
const allowedOrigins = [
  "cockpit.start-berlin.com",
  "staging.cockpit.start-berlin.com",
];

export async function proxy(request: NextRequest) {
  if (publicRoutes.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    const redirectUrl = new URL("/auth", env.NEXT_PUBLIC_COCKPIT_URL);

    // Only store full URL if origin is in whitelist
    const requestOrigin = request.nextUrl.hostname;

    if (allowedOrigins.includes(requestOrigin)) {
      redirectUrl.searchParams.set(
        "redirect",
        request.nextUrl.pathname + request.nextUrl.search,
      );
    }

    return NextResponse.redirect(redirectUrl);
  }

  let maintenanceMode = false;
  try {
    maintenanceMode = (await get<boolean>("maintenanceMode")) === true;
  } catch {
    // EDGE_CONFIG not set or unreachable — maintenance mode treated as inactive
  }

  if (request.nextUrl.pathname === "/maintenance") {
    if (maintenanceMode) return NextResponse.next();

    // Maintenance is off — redirect to the original destination
    const destination = safeRedirectPath(
      request.nextUrl.searchParams.get("redirect"),
    );
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (maintenanceMode) {
    const bypassCookie = request.cookies.get(MAINTENANCE_BYPASS_COOKIE);

    if (bypassCookie?.value === maintenanceBypassSecret()) {
      return NextResponse.next();
    }

    const maintenanceUrl = new URL("/maintenance", request.url);
    maintenanceUrl.searchParams.set(
      "redirect",
      request.nextUrl.pathname + request.nextUrl.search,
    );

    return NextResponse.redirect(maintenanceUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|api|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
