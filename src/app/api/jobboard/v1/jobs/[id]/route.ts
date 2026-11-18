import { jobboardApi } from "@/internal-apps/jobboard/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return jobboardApi.job(request, (await params).id);
}
