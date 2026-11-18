import { publicUrlSchema } from "./contracts";

const jobboardCampaign = {
  utm_source: "start_berlin",
  utm_medium: "referral",
  utm_campaign: "jobboard",
} as const;

export function addJobboardUtmParameters(
  applicationUrl: string,
): string | null {
  const original = publicUrlSchema.safeParse(applicationUrl);
  if (!original.success) return null;

  const url = original.data;
  const existing = new URL(url).searchParams;
  const missing = new URLSearchParams();
  for (const [name, value] of Object.entries(jobboardCampaign)) {
    if (!existing.has(name)) missing.append(name, value);
  }
  if (!missing.size) return url;

  // Reserializing searchParams can change the encoding of existing ATS parameters.
  const hash = url.indexOf("#");
  const base = hash === -1 ? url : url.slice(0, hash);
  const fragment = hash === -1 ? "" : url.slice(hash);
  const query = base.indexOf("?");
  let separator = "&";
  if (query === -1) separator = "?";
  else if (query === base.length - 1 || base.endsWith("&")) separator = "";

  const tagged = `${base}${separator}${missing}${fragment}`;
  return publicUrlSchema.safeParse(tagged).success ? tagged : null;
}
