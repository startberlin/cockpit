import { jobboardApi } from "@/internal-apps/jobboard/lib/api";
import { getCachedCompanyIcon } from "@/internal-apps/jobboard/lib/cached-company-icon";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return jobboardApi.favicon(request, (await params).id, getCachedCompanyIcon);
}
