export const referralCodePattern = /^[1-9A-HJ-NP-Za-km-z]{16}$/;

export function referralUrl(code: string): string {
  if (!referralCodePattern.test(code)) throw new Error("Invalid referral code");
  const url = new URL("https://apply.start-berlin.com/");
  url.searchParams.set("ref", code);
  return url.toString();
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
