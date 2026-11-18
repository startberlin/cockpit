import { getCachedCompanyIcon } from "@/internal-apps/jobboard/lib/cached-company-icon";
import { companyFaviconResponse } from "@/internal-apps/jobboard/lib/company-favicon";
import { service } from "@/internal-apps/jobboard/lib/service";
import { canAccessApp } from "@/lib/apps/server";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || !(await canAccessApp("jobboard"))) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return companyFaviconResponse(
    request,
    await service.getCompanyWebsite(id),
    getCachedCompanyIcon,
    "private, no-cache",
  );
}
