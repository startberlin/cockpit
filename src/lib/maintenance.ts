import { signCookieValue, verifySignedCookie } from "./auth-cookies";

export const MAINTENANCE_BYPASS_COOKIE = "maintenance_bypass";
const BYPASS_LIFETIME = 30 * 60 * 1000;

export async function createMaintenanceBypass(
  sessionId: string,
  secret: string,
  now = Date.now(),
) {
  const expires = new Date(now + BYPASS_LIFETIME);
  const value = await signCookieValue(
    `maintenance:v1:${sessionId}:${expires.getTime()}`,
    secret,
  );
  return { expires, value };
}

export async function verifyMaintenanceBypass(
  cookie: string,
  sessionId: string,
  secret: string,
  now = Date.now(),
) {
  const payload = await verifySignedCookie(cookie, secret);
  const prefix = `maintenance:v1:${sessionId}:`;
  if (!payload?.startsWith(prefix)) return false;
  const expires = Number(payload.slice(prefix.length));
  return (
    Number.isSafeInteger(expires) &&
    expires > now &&
    expires <= now + BYPASS_LIFETIME
  );
}
