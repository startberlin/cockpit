const cockpitUrl = process.env.NEXT_PUBLIC_COCKPIT_URL;

if (!cockpitUrl) {
  throw new Error("Missing NEXT_PUBLIC_COCKPIT_URL");
}

export const COCKPIT_URL = cockpitUrl;
