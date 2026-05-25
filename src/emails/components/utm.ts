interface UtmParams {
  campaign: string;
  content: "button" | "link" | "footer";
  isReminder?: boolean;
}

export function withUtm(
  url: string,
  { campaign, content, isReminder }: UtmParams,
): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", "email");
  u.searchParams.set("utm_medium", "transactional");
  u.searchParams.set(
    "utm_campaign",
    isReminder ? `${campaign}-reminder` : campaign,
  );
  u.searchParams.set("utm_content", content);
  return u.toString();
}
