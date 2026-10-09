export const referralCodePattern = /^[1-9A-HJ-NP-Za-km-z]{16}$/;

export function referralUrl(baseUrl: string, code: string): string {
  if (!referralCodePattern.test(code)) throw new Error("Invalid referral code");
  return new URL(`/r/${code}`, baseUrl).toString();
}

export function applicationUrl(
  baseUrl: string,
  code: string,
  campaignId: string,
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("ref", code);
  url.searchParams.set("campaign", campaignId);
  return url.toString();
}
