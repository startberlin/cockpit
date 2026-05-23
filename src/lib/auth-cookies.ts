// Cookie signing helpers that match Better Auth's format exactly.
// Format: value + "." + base64(HMAC-SHA256(secret, value))
// Note: do NOT pre-encode — cookies().set() (via the cookie package) handles URL-encoding,
// and cookies().get() returns the already-decoded value.

const algorithm = { name: "HMAC", hash: "SHA-256" };

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    algorithm,
    false,
    ["sign", "verify"],
  );
}

async function makeSignature(value: string, secret: string): Promise<string> {
  const key = await getCryptoKey(secret);
  const signature = await crypto.subtle.sign(
    algorithm.name,
    key,
    new TextEncoder().encode(value),
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function signCookieValue(
  value: string,
  secret: string,
): Promise<string> {
  const signature = await makeSignature(value, secret);
  return `${value}.${signature}`;
}

// Input is the already-decoded value from cookies().get().value
export async function verifySignedCookie(
  decodedValue: string,
  secret: string,
): Promise<string | null> {
  try {
    const lastDot = decodedValue.lastIndexOf(".");
    if (lastDot === -1) return null;
    const value = decodedValue.slice(0, lastDot);
    const signature = decodedValue.slice(lastDot + 1);
    const key = await getCryptoKey(secret);
    const sigBuf = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      algorithm.name,
      key,
      sigBuf,
      new TextEncoder().encode(value),
    );
    return valid ? value : null;
  } catch {
    return null;
  }
}
