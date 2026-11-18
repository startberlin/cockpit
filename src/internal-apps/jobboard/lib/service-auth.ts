import { createHash, timingSafeEqual } from "node:crypto";

export type ServiceScope = "read" | "submit" | "metrics";
export type ServiceKeys = Partial<Record<ServiceScope, string>>;

export function serviceKeyStatus(scope: ServiceScope, keys: ServiceKeys) {
  if (!keys[scope]) return "missing";
  return isServiceScopeConfigured(scope, keys) ? "configured" : "invalid";
}

export function isServiceScopeConfigured(
  scope: ServiceScope,
  keys: ServiceKeys,
): boolean {
  const expected = keys[scope];
  return Boolean(
    expected &&
      /^\S{32,512}$/.test(expected) &&
      !Object.entries(keys).some(
        ([key, value]) => key !== scope && value === expected,
      ),
  );
}

/** These credentials belong to trusted servers, never browsers or Cockpit users. */
export function verifyServiceAuthorization(
  authorization: string | null,
  scope: ServiceScope,
  keys: ServiceKeys,
): boolean {
  const expected = keys[scope];
  if (!expected || !isServiceScopeConfigured(scope, keys)) return false;
  const match = authorization?.match(/^Bearer ([^\s]{32,512})$/);
  if (!match) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(match[1]), digest(expected));
}
