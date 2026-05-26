export function register() {}

export const onRequestError = async (
  err: { message: string; stack?: string } & Error,
  request: { headers: { cookie?: string | string[] } },
  _context: unknown,
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getPostHogClient } = require("./src/lib/posthog-server");
    const posthog = getPostHogClient();
    if (!posthog) return;

    let distinctId: string | undefined;

    if (request.headers.cookie) {
      const cookieString = Array.isArray(request.headers.cookie)
        ? request.headers.cookie.join("; ")
        : request.headers.cookie;
      const match = cookieString.match(/ph_phc_.*?_posthog=([^;]+)/);
      if (match?.[1]) {
        try {
          const data = JSON.parse(decodeURIComponent(match[1]));
          distinctId = data.distinct_id;
        } catch {
          // ignore malformed cookie
        }
      }
    }

    await posthog.captureException(err, distinctId);
  }
};
