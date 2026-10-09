import { NextResponse } from "next/server";
import { referralsStore } from "@/internal-apps/referrals/db/server";
import { referralCodePattern } from "@/internal-apps/referrals/lib/links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const headers = {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (!referralCodePattern.test(code))
    return new Response("Referral link not found.", { status: 404, headers });
  const result = await referralsStore.resolveLink(code);
  if (result.status === "unknown_link")
    return new Response("Referral link not found.", { status: 404, headers });
  if (result.status === "closed")
    return new Response("Applications are currently closed.", {
      status: 410,
      headers,
    });
  return NextResponse.redirect(result.url, { status: 302, headers });
}
