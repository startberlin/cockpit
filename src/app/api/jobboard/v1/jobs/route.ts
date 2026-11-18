import { jobboardApi } from "@/internal-apps/jobboard/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = jobboardApi.jobs;
