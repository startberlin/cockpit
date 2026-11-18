const internalOrigin = "https://cockpit.invalid";

/** Return an origin-relative destination safe to use in a second URL parse. */
export function safeRedirectPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return "/";
  if (
    Array.from(value).some(
      (char) =>
        char === "\\" || char.charCodeAt(0) <= 31 || char.charCodeAt(0) === 127,
    )
  )
    return "/";
  const url = new URL(value, internalOrigin);
  if (url.origin !== internalOrigin || url.pathname.startsWith("//"))
    return "/";
  return url.pathname + url.search + url.hash;
}
