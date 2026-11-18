import "server-only";
import { unstable_cache } from "next/cache";
import { type CompanyIcon, fetchCompanyIcon } from "./company-favicon";

const cachedIcon = unstable_cache(
  (host: string) => fetchCompanyIcon(host),
  ["jobboard-company-favicons-v1"],
  { revalidate: 86400 },
);

// A page can request several jobs from one company before the first cache write.
const pending = new Map<string, Promise<CompanyIcon | null>>();

export function getCachedCompanyIcon(host: string) {
  const existing = pending.get(host);
  if (existing) return existing;
  const request = cachedIcon(host).finally(() => pending.delete(host));
  pending.set(host, request);
  return request;
}
