import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const publicRoutes = ["/auth"];
const allowedOrigins = [
  "cockpit.start-berlin.com",
  "staging.cockpit.start-berlin.com",
];

export async function middleware(request: NextRequest) {
  if (publicRoutes.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    const redirectUrl = new URL("/auth", request.url);

    // Only store full URL if origin is in whitelist
    const requestOrigin = request.nextUrl.hostname;

    if (allowedOrigins.includes(requestOrigin)) {
      redirectUrl.searchParams.set("redirect", request.nextUrl.href);
    }

    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|api|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
